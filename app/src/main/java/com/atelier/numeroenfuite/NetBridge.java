package com.atelier.numeroenfuite;

import android.app.Activity;
import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Transport du multijoueur Wi-Fi local, exposé au jeu sous le nom {@code window.NumeroNet}.
 *
 * <p>Ce pont ne connaît RIEN des règles : il transporte des chaînes JSON entre téléphones.
 * Toute la logique (salle d'attente, arbitrage, secret) est dans src/js/15-net.js.
 * Contrat complet : docs/MULTIJOUEUR.md.</p>
 *
 * <ul>
 *   <li>Hôte : serveur TCP sur un port libre + annonce du service « NEF-&lt;code&gt; » (NSD / mDNS).</li>
 *   <li>Invité : recherche du service « NEF-&lt;code&gt; » sur le Wi-Fi, puis connexion TCP.</li>
 *   <li>Messages : une ligne JSON UTF-8 par message ({@code \n} final).</li>
 *   <li>Événements vers le jeu : {@code window.__netEvent('{"type":…}')} sur le fil principal.</li>
 * </ul>
 *
 * <p>Sécurité : réseau local uniquement, 3 invités au maximum, lignes limitées en taille ;
 * le code de la partie est vérifié par le jeu (message « hello »).</p>
 */
public final class NetBridge {

    private static final String SERVICE_TYPE = "_nefgame._tcp.";
    private static final String SERVICE_PREFIX = "NEF-";
    private static final int MAX_GUESTS = 3;
    private static final int MAX_LINE = 512 * 1024;
    private static final long JOIN_TIMEOUT_MS = 12000;

    private final Activity activity;
    private final WebView web;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newCachedThreadPool();
    /** Écritures dans l'ordre d'envoi, sur un seul fil. */
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private final Map<String, Socket> guests = new ConcurrentHashMap<>();
    private final NsdManager nsd;

    private volatile boolean running;
    private volatile ServerSocket server;
    private volatile Socket hostLink;
    private int peerSeq;
    private NsdManager.RegistrationListener registration;
    private NsdManager.DiscoveryListener discovery;
    /** V9.18 : recherche des parties proches (liste « Partie de Zied »), indépendante de joinStart. */
    private NsdManager.DiscoveryListener scan;
    /*
     * V9.25 : une partie n'est montrée que si son hôte répond VRAIMENT (connexion TCP de contrôle), et elle
     * disparaît dès qu'il ne répond plus. Android garde parfois en cache des annonces de parties terminées
     * (application fermée sans « au revoir » mDNS) : elles ne s'affichent plus.
     * Maps lues / écrites sur le fil principal (sauf la connexion de contrôle, sur `io`).
     */
    private static final long PROBE_EVERY_MS = 4000;
    private static final int PROBE_TIMEOUT_MS = 1500;
    private final Map<String, NsdServiceInfo> scanFound = new ConcurrentHashMap<>();
    private final Map<String, InetSocketAddress> scanAddr = new ConcurrentHashMap<>();
    private final Map<String, Boolean> scanAlive = new ConcurrentHashMap<>();
    private final ArrayDeque<String> resolveQueue = new ArrayDeque<>();
    private boolean scanResolving;
    private final Runnable probeTick = new Runnable() {
        @Override
        public void run() {
            if (scan == null) return;
            for (String name : scanFound.keySet()) {
                if (scanAddr.containsKey(name)) probe(name);
                else queueResolve(name);
            }
            main.postDelayed(this, PROBE_EVERY_MS);
        }
    };
    private WifiManager.MulticastLock multicastLock;
    private Runnable joinTimeout;

    NetBridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        this.nsd = (NsdManager) activity.getSystemService(Context.NSD_SERVICE);
    }

    /* ---------------- Hôte ---------------- */

    /** Ancienne signature (sans prénom), gardée pour compatibilité. */
    @JavascriptInterface
    public void hostStart(final String code) {
        hostStart(code, "");
    }

    /**
     * Crée la partie : serveur TCP + annonce « NEF-code-Prénom » sur le réseau local.
     * V9.18 : le prénom de l'hôte permet aux autres de voir « Partie de Zied » sans taper le code.
     */
    @JavascriptInterface
    public void hostStart(final String code, final String hostName) {
        stop();
        running = true;
        acquireMulticast();
        io.execute(() -> {
            try {
                final ServerSocket ss = new ServerSocket(0);
                server = ss;
                final int port = ss.getLocalPort();
                main.post(() -> register(clean(code), port, hostName));
                JSONObject ev = event("hosting");
                ev.put("port", port);
                String ip = localIp();
                if (ip != null) ev.put("ip", ip);
                emit(ev);
                while (running && !ss.isClosed()) {
                    Socket s = ss.accept();
                    if (guests.size() >= MAX_GUESTS) {
                        closeQuietly(s);
                        continue;
                    }
                    s.setTcpNoDelay(true);
                    final String peer = "p" + (++peerSeq);
                    guests.put(peer, s);
                    emit(event("peerJoined").put("peer", peer));
                    io.execute(() -> readLoop(s, peer));
                }
            } catch (IOException | JSONException e) {
                if (running) emitError("host");
            }
        });
    }

    private void register(String code, int port, String hostName) {
        if (nsd == null || !running) return;
        NsdServiceInfo info = new NsdServiceInfo();
        info.setServiceName(serviceName(code, hostName));
        info.setServiceType(SERVICE_TYPE);
        info.setPort(port);
        registration = new NsdManager.RegistrationListener() {
            @Override public void onServiceRegistered(NsdServiceInfo i) { }
            @Override public void onRegistrationFailed(NsdServiceInfo i, int err) { emitError("host"); }
            @Override public void onServiceUnregistered(NsdServiceInfo i) { }
            @Override public void onUnregistrationFailed(NsdServiceInfo i, int err) { }
        };
        try {
            nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, registration);
        } catch (RuntimeException e) {
            registration = null;
            emitError("host");
        }
    }

    /** « NEF-1234-Zied » : 63 octets au plus (limite DNS-SD), sans caractères de contrôle ni point. */
    static String serviceName(String code, String hostName) {
        String base = SERVICE_PREFIX + code;
        String n = hostName == null ? "" : hostName.replaceAll("[\\p{Cntrl}.\\\\]", " ").trim().replaceAll("\\s+", " ");
        if (n.isEmpty()) return base;
        String full = base + "-" + n;
        while (full.getBytes(StandardCharsets.UTF_8).length > 63)
            full = full.substring(0, full.offsetByCodePoints(0, full.codePointCount(0, full.length()) - 1));
        return full.trim();
    }

    /* ---------------- Parties proches (V9.18) ---------------- */

    /** Cherche les parties annoncées sur le Wi-Fi : événements « room » / « roomLost » avec code et prénom. */
    @JavascriptInterface
    public void scanStart() {
        main.post(() -> {
            stopScan();
            if (nsd == null) return;
            acquireMulticast();
            scan = new NsdManager.DiscoveryListener() {
                @Override public void onDiscoveryStarted(String type) { }
                @Override public void onDiscoveryStopped(String type) { }
                @Override public void onStartDiscoveryFailed(String type, int err) { scan = null; }
                @Override public void onStopDiscoveryFailed(String type, int err) { }
                @Override public void onServiceFound(final NsdServiceInfo info) {
                    final String name = info.getServiceName();
                    if (name == null) return;
                    main.post(() -> {
                        if (scan == null) return;
                        scanFound.put(name, info);
                        queueResolve(name);
                    });
                }
                @Override public void onServiceLost(NsdServiceInfo info) {
                    final String name = info.getServiceName();
                    if (name == null) return;
                    main.post(() -> {
                        scanFound.remove(name);
                        scanAddr.remove(name);
                        if (Boolean.TRUE.equals(scanAlive.remove(name))) room("roomLost", name);
                    });
                }
            };
            try {
                nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, scan);
                main.postDelayed(probeTick, PROBE_EVERY_MS);
            } catch (RuntimeException e) {
                scan = null;
            }
        });
    }

    /** Une résolution à la fois (certains Android refusent les résolutions simultanées). Fil principal. */
    private void queueResolve(String name) {
        if (!resolveQueue.contains(name)) resolveQueue.add(name);
        resolveNext();
    }

    @SuppressWarnings("deprecation")
    private void resolveNext() {
        if (scanResolving || scan == null || nsd == null) return;
        String next;
        NsdServiceInfo info = null;
        do {
            next = resolveQueue.poll();
            if (next != null) info = scanFound.get(next);
        } while (next != null && info == null);
        if (next == null) return;
        final String name = next;
        scanResolving = true;
        try {
            nsd.resolveService(info, new NsdManager.ResolveListener() {
                @Override
                public void onResolveFailed(NsdServiceInfo i, int err) {
                    main.post(() -> {
                        scanResolving = false;
                        setAlive(name, false);
                        resolveNext();
                    });
                }

                @Override
                public void onServiceResolved(final NsdServiceInfo i) {
                    main.post(() -> {
                        scanResolving = false;
                        if (scanFound.containsKey(name) && i.getHost() != null) {
                            scanAddr.put(name, new InetSocketAddress(i.getHost(), i.getPort()));
                            probe(name);
                        }
                        resolveNext();
                    });
                }
            });
        } catch (RuntimeException e) {
            scanResolving = false;
        }
    }

    /** Connexion de contrôle (ouverte puis refermée aussitôt) : l'hôte de cette partie répond-il ? */
    private void probe(final String name) {
        final InetSocketAddress addr = scanAddr.get(name);
        if (addr == null) return;
        io.execute(() -> {
            boolean ok;
            try (Socket s = new Socket()) {
                s.connect(addr, PROBE_TIMEOUT_MS);
                ok = true;
            } catch (IOException e) {
                ok = false;
            }
            final boolean alive = ok;
            main.post(() -> setAlive(name, alive));
        });
    }

    /** Fil principal : n'envoie au jeu que les changements (apparition / disparition d'une partie). */
    private void setAlive(String name, boolean alive) {
        if (scan == null || !scanFound.containsKey(name)) return;
        Boolean was = scanAlive.put(name, alive);
        if (alive && !Boolean.TRUE.equals(was)) room("room", name);
        else if (!alive && Boolean.TRUE.equals(was)) room("roomLost", name);
    }

    @JavascriptInterface
    public void scanStop() {
        main.post(this::stopScan);
    }

    private void stopScan() {
        main.removeCallbacks(probeTick);
        resolveQueue.clear();
        scanResolving = false;
        scanFound.clear();
        scanAddr.clear();
        scanAlive.clear();
        if (scan != null && nsd != null) {
            try {
                nsd.stopServiceDiscovery(scan);
            } catch (RuntimeException ignored) {
                // déjà arrêtée
            }
        }
        scan = null;
    }

    /** « NEF-1234-Zied (2) » → { code: 1234, name: Zied } (NSD ajoute « (2) » aux doublons). */
    private void room(String type, String serviceName) {
        String name = unescape(serviceName);
        if (name == null || !name.startsWith(SERVICE_PREFIX)) return;
        String rest = name.substring(SERVICE_PREFIX.length()).replaceAll(" \\(\\d+\\)$", "");
        if (rest.length() < 4 || !rest.substring(0, 4).matches("\\d{4}")) return;
        String host = rest.length() > 5 && rest.charAt(4) == '-' ? rest.substring(5) : "";
        try {
            emit(event(type).put("code", rest.substring(0, 4)).put("name", host));
        } catch (JSONException ignored) {
            // impossible : valeurs simples
        }
    }

    /** Certains Android renvoient les noms DNS-SD échappés (« \\032 » pour une espace, octets UTF-8 en « \\DDD »). */
    static String unescape(String s) {
        if (s == null || s.indexOf('\\') < 0) return s;
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 3 < s.length() && s.substring(i + 1, i + 4).matches("\\d{3}")) {
                out.write(Integer.parseInt(s.substring(i + 1, i + 4)));
                i += 3;
            } else if (c == '\\' && i + 1 < s.length()) {
                byte[] b = String.valueOf(s.charAt(i + 1)).getBytes(StandardCharsets.UTF_8);
                out.write(b, 0, b.length);
                i += 1;
            } else {
                byte[] b = String.valueOf(c).getBytes(StandardCharsets.UTF_8);
                out.write(b, 0, b.length);
            }
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    /* ---------------- Invité ---------------- */

    /** Rejoint la partie « NEF-code » trouvée sur le Wi-Fi (12 s maximum). */
    @JavascriptInterface
    public void joinStart(final String code) {
        stop();
        running = true;
        acquireMulticast();
        if (nsd == null) {
            emitError("notFound");
            return;
        }
        final String wanted = SERVICE_PREFIX + clean(code);
        main.post(() -> {
            discovery = new NsdManager.DiscoveryListener() {
                private boolean resolving;

                @Override public void onDiscoveryStarted(String type) { }
                @Override public void onDiscoveryStopped(String type) { }
                @Override public void onStartDiscoveryFailed(String type, int err) { emitError("wifi"); }
                @Override public void onStopDiscoveryFailed(String type, int err) { }
                @Override public void onServiceLost(NsdServiceInfo info) { }

                @Override
                public void onServiceFound(NsdServiceInfo info) {
                    // NSD peut renommer « NEF-1234 (2) » en cas de doublon : on compare le début du nom
                    if (resolving || info.getServiceName() == null || !info.getServiceName().startsWith(wanted)) return;
                    resolving = true;
                    resolve(info);
                }
            };
            try {
                nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discovery);
            } catch (RuntimeException e) {
                discovery = null;
                emitError("wifi");
                return;
            }
            joinTimeout = () -> {
                if (running && hostLink == null) {
                    stopDiscovery();
                    emitError("notFound");
                }
            };
            main.postDelayed(joinTimeout, JOIN_TIMEOUT_MS);
        });
    }

    @SuppressWarnings("deprecation")
    private void resolve(NsdServiceInfo info) {
        nsd.resolveService(info, new NsdManager.ResolveListener() {
            @Override
            public void onResolveFailed(NsdServiceInfo i, int err) {
                emitError("notFound");
            }

            @Override
            public void onServiceResolved(NsdServiceInfo i) {
                main.post(NetBridge.this::stopDiscovery);
                connect(i.getHost(), i.getPort());
            }
        });
    }

    private void connect(final InetAddress host, final int port) {
        io.execute(() -> {
            try {
                Socket s = new Socket();
                s.connect(new InetSocketAddress(host, port), 5000);
                s.setTcpNoDelay(true);
                hostLink = s;
                if (joinTimeout != null) main.removeCallbacks(joinTimeout);
                emit(event("connected"));
                readLoop(s, "host");
            } catch (IOException | JSONException e) {
                if (running) emitError("notFound");
            }
        });
    }

    /* ---------------- Messages ---------------- */

    /** Envoie une ligne JSON : à un invité (« p1 »…) côté hôte, ou à l'hôte (« host ») côté invité. */
    @JavascriptInterface
    public void send(final String peer, final String data) {
        if (data == null || data.length() > MAX_LINE || data.indexOf('\n') >= 0) return;
        final Socket s = "host".equals(peer) ? hostLink : guests.get(peer);
        if (s == null) return;
        writer.execute(() -> {
            try {
                OutputStream out = s.getOutputStream();
                out.write((data + "\n").getBytes(StandardCharsets.UTF_8));
                out.flush();
            } catch (IOException e) {
                closeQuietly(s); // la lecture détectera la fermeture et préviendra le jeu
            }
        });
    }

    private void readLoop(Socket s, String peer) {
        try (BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while (running && (line = in.readLine()) != null) {
                if (line.length() > MAX_LINE) break;
                emit(event("message").put("peer", peer).put("data", line));
            }
        } catch (IOException | JSONException ignored) {
            // connexion coupée
        } finally {
            closeQuietly(s);
            if (running) {
                try {
                    if ("host".equals(peer)) {
                        hostLink = null;
                        emit(event("disconnected"));
                    } else {
                        guests.remove(peer);
                        emit(event("peerLeft").put("peer", peer));
                    }
                } catch (JSONException ignored) {
                    // impossible : clés et valeurs fixes
                }
            }
        }
    }

    /* ---------------- Fin, écran ---------------- */

    /** Coupe tout (serveur, invités, lien vers l'hôte, annonce et recherche) sans prévenir le jeu. */
    @JavascriptInterface
    public void stop() {
        running = false;
        if (joinTimeout != null) main.removeCallbacks(joinTimeout);
        closeQuietly(server);
        server = null;
        closeQuietly(hostLink);
        hostLink = null;
        for (Socket s : guests.values()) closeQuietly(s);
        guests.clear();
        main.post(() -> {
            if (registration != null && nsd != null) {
                try {
                    nsd.unregisterService(registration);
                } catch (RuntimeException ignored) {
                    // déjà retiré
                }
                registration = null;
            }
            stopDiscovery();
            stopScan();
            if (multicastLock != null && multicastLock.isHeld()) multicastLock.release();
        });
    }

    /** Garde l'écran allumé pendant une partie Wi-Fi (sinon Android coupe la connexion). */
    @JavascriptInterface
    public void keepAwake(final boolean on) {
        activity.runOnUiThread(() -> {
            if (on) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    /** Appelé par MainActivity à la fermeture. */
    void shutdown() {
        stop();
        io.shutdownNow();
        writer.shutdownNow();
    }

    /* ---------------- Outils ---------------- */

    private void stopDiscovery() {
        if (discovery != null && nsd != null) {
            try {
                nsd.stopServiceDiscovery(discovery);
            } catch (RuntimeException ignored) {
                // déjà arrêtée
            }
            discovery = null;
        }
    }

    /** Certains téléphones filtrent le multicast (mDNS) Wi-Fi sans ce verrou. */
    private void acquireMulticast() {
        WifiManager wifi = (WifiManager) activity.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wifi == null) return;
        if (multicastLock == null) {
            multicastLock = wifi.createMulticastLock("numero-en-fuite");
            multicastLock.setReferenceCounted(false);
        }
        if (!multicastLock.isHeld()) multicastLock.acquire();
    }

    /** Adresse IPv4 locale (Wi-Fi ou partage de connexion), affichée en petit sur l'écran de l'hôte. */
    private static String localIp() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) return a.getHostAddress();
                }
            }
        } catch (Exception ignored) {
            // pas d'adresse : simple information en moins
        }
        return null;
    }

    private static String clean(String code) {
        return code == null ? "" : code.replaceAll("[^0-9]", "");
    }

    private static JSONObject event(String type) throws JSONException {
        return new JSONObject().put("type", type);
    }

    private void emitError(String code) {
        try {
            emit(event("error").put("code", code));
        } catch (JSONException ignored) {
            // impossible : clés et valeurs fixes
        }
    }

    /** Transmet un événement au jeu, sur le fil principal (obligatoire pour la WebView). */
    private void emit(JSONObject ev) {
        final String js = "window.__netEvent&&window.__netEvent(" + JSONObject.quote(ev.toString()) + ")";
        main.post(() -> web.evaluateJavascript(js, null));
    }

    private static void closeQuietly(java.io.Closeable c) {
        if (c == null) return;
        try {
            c.close();
        } catch (IOException ignored) {
            // déjà fermé
        }
    }
}
