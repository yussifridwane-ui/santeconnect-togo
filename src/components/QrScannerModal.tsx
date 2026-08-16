"use client";

/* ════════════════════════════════════════════════════════════════════
   ▦ V3.1 — SCANNER QR CODE (cartes d'assurance maladie)
   Vue caméra en direct dans une fenêtre modale ; dès qu'un QR entre
   dans le cadre, son contenu est capturé (lien de vérification ou
   numéro d'assuré) et renvoyé au formulaire.
   Utilise BarcodeDetector (intégré à Chrome/Android) : AUCUNE librairie
   externe, AUCUNE image ne quitte l'appareil — tout se passe localement.
   Navigateur incompatible → message clair + repli sur la photo de carte.
   ════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { X, ScanLine, Loader2, AlertTriangle } from "lucide-react";

export default function QrScannerModal({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    stoppedRef.current = false;

    const stopAll = () => {
      stoppedRef.current = true;
      if (timer) clearInterval(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    const start = async () => {
      /* Le navigateur sait-il lire les QR ? (Chrome Android/desktop oui) */
      const Win = window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> } };
      if (!Win.BarcodeDetector) {
        setError(
          "Ce navigateur ne sait pas lire les QR directement. Astuce : utilise Chrome sur Android — ou photographie simplement la carte.",
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Caméra inaccessible ici (il faut une page sécurisée https). Photographie la carte à la place.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, // caméra ARRIÈRE (le dos de la carte)
          audio: false,
        });
        const video = videoRef.current;
        if (!video || stoppedRef.current) {
          stopAll();
          return;
        }
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const detector = new Win.BarcodeDetector({ formats: ["qr_code"] });
        timer = setInterval(async () => {
          if (stoppedRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              const text = String(codes[0].rawValue).slice(0, 2000);
              stopAll();
              onResult(text);
            }
          } catch {
            /* une frame illisible n'est pas grave — on continue */
          }
        }, 350);
      } catch {
        setError(
          "Caméra refusée ou indisponible. Autorise l'accès caméra quand le téléphone le demande — ou photographie la carte.",
        );
      }
    };

    start();
    return stopAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <ScanLine size={18} className="text-indigo-600" />
          <p className="font-bold text-gray-900 text-sm">Scanner le QR de la carte</p>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle size={17} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          ) : (
            <>
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                {!ready && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm gap-2">
                    <Loader2 size={18} className="animate-spin" /> Démarrage de la caméra…
                  </div>
                )}
                {/* Cadre de visée */}
                <div className="absolute inset-6 border-2 border-emerald-400/80 rounded-xl pointer-events-none" />
              </div>
              <p className="text-xs text-gray-500 text-center mt-3">
                📇 Cadrez le <b>QR code OU le code-barres rectangulaire</b> (PDF417) au dos de
                la carte — la lecture est <b>automatique</b> et reste sur votre appareil.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
