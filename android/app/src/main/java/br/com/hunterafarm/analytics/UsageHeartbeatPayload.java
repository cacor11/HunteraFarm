package br.com.hunterafarm.analytics;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Builds the deliberately small JSON body sent by the usage reporter. */
final class UsageHeartbeatPayload {
    private UsageHeartbeatPayload() {
    }

    static byte[] create(String installationId, String version) {
        String json = "{\"installation_id\":\""
                + escapeJson(installationId)
                + "\",\"platform\":\"android\",\"version\":\""
                + escapeJson(version)
                + "\"}";
        return json.getBytes(StandardCharsets.UTF_8);
    }

    private static String escapeJson(String value) {
        StringBuilder escaped = new StringBuilder(value.length());
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '\\':
                    escaped.append("\\\\");
                    break;
                case '"':
                    escaped.append("\\\"");
                    break;
                case '\b':
                    escaped.append("\\b");
                    break;
                case '\f':
                    escaped.append("\\f");
                    break;
                case '\n':
                    escaped.append("\\n");
                    break;
                case '\r':
                    escaped.append("\\r");
                    break;
                case '\t':
                    escaped.append("\\t");
                    break;
                default:
                    if (character < 0x20) {
                        escaped.append(String.format(Locale.ROOT, "\\u%04x", (int) character));
                    } else {
                        escaped.append(character);
                    }
            }
        }
        return escaped.toString();
    }
}
