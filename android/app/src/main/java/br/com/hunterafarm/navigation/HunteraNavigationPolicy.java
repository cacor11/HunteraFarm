package br.com.hunterafarm.navigation;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Restricts the embedded main frame to Huntera over HTTPS. */
public final class HunteraNavigationPolicy {
    public static final String HOME_URL = "https://huntera.com.br/?r=Caco";
    private static final String ROOT_HOST = "huntera.com.br";

    private HunteraNavigationPolicy() {
    }

    public static boolean isEmbeddedUrlAllowed(String rawUrl) {
        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            return false;
        }

        try {
            URI uri = new URI(rawUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null || !"https".equalsIgnoreCase(scheme)) {
                return false;
            }

            String normalizedHost = host.toLowerCase(Locale.ROOT);
            return normalizedHost.equals(ROOT_HOST)
                    || normalizedHost.endsWith("." + ROOT_HOST);
        } catch (URISyntaxException exception) {
            return false;
        }
    }
}
