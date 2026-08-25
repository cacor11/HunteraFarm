package br.com.hunterafarm.analytics;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

import java.nio.charset.StandardCharsets;

public class UsageHeartbeatPayloadTest {
    @Test
    public void containsOnlyAnonymousInstallationPlatformAndVersionFields() {
        byte[] body = UsageHeartbeatPayload.create(
                "123e4567-e89b-12d3-a456-426614174000",
                "0.1.3-beta"
        );

        assertEquals(
                "{\"installation_id\":\"123e4567-e89b-12d3-a456-426614174000\","
                        + "\"platform\":\"android\",\"version\":\"0.1.3-beta\"}",
                new String(body, StandardCharsets.UTF_8)
        );
    }

    @Test
    public void escapesUnexpectedVersionCharactersAsValidJson() {
        byte[] body = UsageHeartbeatPayload.create("id", "beta\n\"test\"");

        assertEquals(
                "{\"installation_id\":\"id\",\"platform\":\"android\","
                        + "\"version\":\"beta\\n\\\"test\\\"\"}",
                new String(body, StandardCharsets.UTF_8)
        );
    }
}
