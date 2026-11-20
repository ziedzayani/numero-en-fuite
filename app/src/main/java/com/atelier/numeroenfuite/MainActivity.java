package com.atelier.numeroenfuite;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Le Numéro en fuite — conteneur Android.
 * Le jeu complet (HTML/CSS/JS) est embarqué dans assets/index.html et fonctionne hors ligne.
 * Aucune navigation externe : la WebView n'ouvre que les pages du jeu embarqué.
 * Réseau : uniquement le multijoueur Wi-Fi LOCAL, via {@link NetBridge} (window.NumeroNet),
 * entre téléphones du même réseau ; aucun accès Internet, aucun serveur.
 */
public class MainActivity extends Activity {

    private static final String GAME_URL = "file:///android_asset/index.html";
    private static final int SKY = 0xFF1A2B66;

    private WebView game;
    private NetBridge net;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Conteneur bleu qui reçoit les marges des barres système.
        // Indispensable sur Android 15+ (targetSdk 35) où l'affichage « bord à bord » est imposé :
        // sans ces marges, le haut du jeu passerait sous la barre d'état.
        final FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(SKY);
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @SuppressWarnings("deprecation")
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int left, top, right, bottom;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    android.graphics.Insets bars = insets.getInsets(
                            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    left = bars.left; top = bars.top; right = bars.right; bottom = bars.bottom;
                } else {
                    left = insets.getSystemWindowInsetLeft();
                    top = insets.getSystemWindowInsetTop();
                    right = insets.getSystemWindowInsetRight();
                    bottom = insets.getSystemWindowInsetBottom();
                }
                v.setPadding(left, top, right, bottom);
                // Les marges sont déjà appliquées ici : on ne les transmet PAS à la WebView.
                // Sinon les WebView récentes les recomptent (env(safe-area-inset-*) dans le CSS) :
                // ~40 dp perdus en haut et en bas, d'où un défilement en partie sur téléphone (V8.16).
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) return WindowInsets.CONSUMED;
                return insets.consumeSystemWindowInsets();
            }
        });

        game = new WebView(this);
        game.setBackgroundColor(SKY);
        game.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings s = game.getSettings();
        s.setJavaScriptEnabled(true);          // le jeu est écrit en JavaScript
        s.setDomStorageEnabled(true);          // sauvegarde locale (localStorage)
        s.setAllowFileAccess(false);           // file:///android_asset reste accessible
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);                    // mise en page stable quelle que soit la taille de police système
        s.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(true);
        }

        // Multijoueur Wi-Fi local : seul objet exposé au JavaScript (messages texte entre téléphones).
        net = new NetBridge(this, game);
        game.addJavascriptInterface(net, "NumeroNet");
        // V9.18 : partage de la carte de victoire (menu de partage Android, aucune autorisation)
        game.addJavascriptInterface(new ShareBridge(this), "NumeroShare");

        game.setWebChromeClient(new WebChromeClient());
        game.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isGameUrl(request.getUrl().toString());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isGameUrl(url);
            }
        });

        root.addView(game, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Icônes claires dans les barres système (fond bleu).
        getWindow().getDecorView().setSystemUiVisibility(0);
        if (Build.VERSION.SDK_INT < 35) {
            getWindow().setStatusBarColor(SKY);
            getWindow().setNavigationBarColor(SKY);
        } else {
            getWindow().setNavigationBarContrastEnforced(false);
            getWindow().setStatusBarColor(Color.TRANSPARENT);
        }
        root.requestApplyInsets();

        game.loadUrl(GAME_URL);
    }

    /** Seules les pages du jeu embarqué peuvent s'ouvrir : aucun lien externe, aucune page web. */
    private static boolean isGameUrl(String url) {
        return url != null && url.startsWith("file:///android_asset/");
    }

    /** Bouton Retour : le jeu ferme d'abord ses écrans (réglages, confirmation…), puis l'appli se ferme. */
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (game == null) {
            super.onBackPressed();
            return;
        }
        game.evaluateJavascript(
                "(function(){try{return !!(window.__numero&&window.__numero.back());}catch(e){return false;}})()",
                value -> {
                    if (!"true".equals(value)) {
                        finish();
                    }
                });
    }

    @Override
    protected void onPause() {
        if (game != null) game.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (game != null) game.onResume();
    }

    @Override
    protected void onDestroy() {
        if (net != null) {
            net.shutdown();
            net = null;
        }
        if (game != null) {
            ViewGroup parent = (ViewGroup) game.getParent();
            if (parent != null) parent.removeView(game);
            game.destroy();
            game = null;
        }
        super.onDestroy();
    }
}
