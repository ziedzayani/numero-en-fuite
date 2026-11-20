package com.atelier.numeroenfuite;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * V9.18 : partage de la carte de victoire, exposé au jeu sous le nom {@code window.NumeroShare}.
 * Le jeu dessine l'image (PNG en base64) ; ici on l'écrit dans le cache et on ouvre le menu de partage Android.
 * Aucune autorisation, aucun accès Internet : c'est l'application choisie par le joueur qui envoie l'image.
 */
final class ShareBridge {

    private static final int MAX_B64 = 8 * 1024 * 1024;
    private final Activity activity;

    ShareBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void shareImage(final String pngBase64, final String text) {
        if (pngBase64 == null || pngBase64.length() > MAX_B64) return;
        new Thread(() -> {
            try {
                byte[] png = Base64.decode(pngBase64, Base64.DEFAULT);
                File f = ShareProvider.shareFile(activity);
                File dir = f.getParentFile();
                if (dir != null && !dir.exists() && !dir.mkdirs()) return;
                try (FileOutputStream out = new FileOutputStream(f)) {
                    out.write(png);
                }
                Uri uri = Uri.parse("content://" + activity.getPackageName() + ".share/" + ShareProvider.FILE_NAME);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("image/png");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
                send.setClipData(ClipData.newRawUri("", uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                final Intent chooser = Intent.createChooser(send, null);
                activity.runOnUiThread(() -> {
                    try {
                        activity.startActivity(chooser);
                    } catch (RuntimeException ignored) {
                        // aucune application de partage : rien à faire
                    }
                });
            } catch (IOException | IllegalArgumentException ignored) {
                // image invalide ou stockage plein : le partage n'a simplement pas lieu
            }
        }).start();
    }
}
