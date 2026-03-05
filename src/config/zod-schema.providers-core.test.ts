import { describe, expect, it } from "vitest";
import {
  BlueBubblesConfigSchema,
  DiscordAccountSchema,
  DiscordConfigSchema,
  GoogleChatConfigSchema,
  GoogleChatDmSchema,
  IMessageConfigSchema,
  IrcAccountSchema,
  IrcConfigSchema,
  IrcNickServSchema,
  MSTeamsConfigSchema,
  SignalConfigSchema,
  SlackConfigSchema,
  TelegramConfigSchema,
  TelegramGroupSchema,
  TelegramTopicSchema,
} from "./zod-schema.providers-core.js";

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

describe("TelegramTopicSchema", () => {
  it("accepts a minimal topic (no fields required)", () => {
    const result = TelegramTopicSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated topic", () => {
    const result = TelegramTopicSchema.safeParse({
      requireMention: true,
      enabled: false,
      allowFrom: [123, "alice"],
      systemPrompt: "You are a helper.",
      agentId: "my-agent",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requireMention).toBe(true);
      expect(result.data.agentId).toBe("my-agent");
    }
  });

  it("rejects unknown fields (strict mode)", () => {
    const result = TelegramTopicSchema.safeParse({ unknownField: true });
    expect(result.success).toBe(false);
  });
});

describe("TelegramGroupSchema", () => {
  it("accepts an empty group config", () => {
    const result = TelegramGroupSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts topics nested inside a group", () => {
    const result = TelegramGroupSchema.safeParse({
      enabled: true,
      topics: {
        "100": { requireMention: false },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topics?.["100"]?.requireMention).toBe(false);
    }
  });

  it("rejects unknown fields in group config (strict mode)", () => {
    const result = TelegramGroupSchema.safeParse({ bogusField: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("TelegramConfigSchema – dmPolicy / allowFrom enforcement", () => {
  it('rejects dmPolicy="open" without allowFrom containing "*"', () => {
    const result = TelegramConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["12345"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("allowFrom"))).toBe(true);
    }
  });

  it('accepts dmPolicy="open" with allowFrom containing "*"', () => {
    const result = TelegramConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["*"],
    });
    expect(result.success).toBe(true);
  });

  it('rejects dmPolicy="allowlist" without any allowFrom entries', () => {
    const result = TelegramConfigSchema.safeParse({
      dmPolicy: "allowlist",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("allowFrom"))).toBe(true);
    }
  });

  it('accepts dmPolicy="allowlist" with at least one allowFrom entry', () => {
    const result = TelegramConfigSchema.safeParse({
      dmPolicy: "allowlist",
      allowFrom: ["99887766"],
    });
    expect(result.success).toBe(true);
  });

  it('accepts dmPolicy="pairing" without any allowFrom', () => {
    const result = TelegramConfigSchema.safeParse({
      dmPolicy: "pairing",
    });
    expect(result.success).toBe(true);
  });

  it("account-level inherits allowFrom for allowlist enforcement", () => {
    // Account with dmPolicy="allowlist" but no own allowFrom — parent provides it.
    const result = TelegramConfigSchema.safeParse({
      allowFrom: ["555"],
      accounts: {
        bot1: { dmPolicy: "allowlist" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("account-level rejects allowlist when neither account nor parent has allowFrom", () => {
    const result = TelegramConfigSchema.safeParse({
      accounts: {
        bot1: { dmPolicy: "allowlist" },
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("allowFrom"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Discord
// ---------------------------------------------------------------------------

describe("DiscordAccountSchema – activity validation", () => {
  it("accepts a config with no activity fields", () => {
    const result = DiscordAccountSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects activityType without activity text", () => {
    const result = DiscordAccountSchema.safeParse({ activityType: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("activity"))).toBe(true);
    }
  });

  it("accepts activityType with activity text", () => {
    const result = DiscordAccountSchema.safeParse({
      activity: "Playing chess",
      activityType: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activity).toBe("Playing chess");
    }
  });

  it("rejects activityType=1 (Streaming) without activityUrl", () => {
    const result = DiscordAccountSchema.safeParse({
      activity: "Live now",
      activityType: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("activityUrl"))).toBe(true);
    }
  });

  it("accepts activityType=1 with both activity and activityUrl", () => {
    const result = DiscordAccountSchema.safeParse({
      activity: "Live coding",
      activityType: 1,
      activityUrl: "https://twitch.tv/openclaw",
    });
    expect(result.success).toBe(true);
  });

  it("rejects activityUrl without activityType=1", () => {
    const result = DiscordAccountSchema.safeParse({
      activity: "Watching something",
      activityType: 3,
      activityUrl: "https://twitch.tv/openclaw",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("activityType"))).toBe(true);
    }
  });

  it("rejects autoPresence.minUpdateIntervalMs > intervalMs", () => {
    const result = DiscordAccountSchema.safeParse({
      autoPresence: {
        intervalMs: 5000,
        minUpdateIntervalMs: 10000,
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("minUpdateIntervalMs"))).toBe(true);
    }
  });

  it("accepts autoPresence with minUpdateIntervalMs <= intervalMs", () => {
    const result = DiscordAccountSchema.safeParse({
      autoPresence: {
        intervalMs: 10000,
        minUpdateIntervalMs: 5000,
      },
    });
    expect(result.success).toBe(true);
  });

  it("normalises legacy streamMode into streaming", () => {
    const result = DiscordAccountSchema.safeParse({ streamMode: "block" });
    expect(result.success).toBe(true);
    if (result.success) {
      // streamMode should be consumed and streaming set
      expect(result.data.streamMode).toBeUndefined();
    }
  });
});

describe("DiscordConfigSchema – dmPolicy / allowFrom enforcement", () => {
  it('rejects dmPolicy="open" without allowFrom "*"', () => {
    const result = DiscordConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["123"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("allowFrom"))).toBe(true);
    }
  });

  it('accepts dmPolicy="open" with allowFrom ["*"]', () => {
    const result = DiscordConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["*"],
    });
    expect(result.success).toBe(true);
  });

  it('rejects dmPolicy="allowlist" without allowFrom', () => {
    const result = DiscordConfigSchema.safeParse({ dmPolicy: "allowlist" });
    expect(result.success).toBe(false);
  });

  it('accepts dmPolicy="allowlist" with non-empty allowFrom', () => {
    const result = DiscordConfigSchema.safeParse({
      dmPolicy: "allowlist",
      allowFrom: ["987654321"],
    });
    expect(result.success).toBe(true);
  });

  it("account allowlist inherits parent allowFrom", () => {
    const result = DiscordConfigSchema.safeParse({
      allowFrom: ["111"],
      accounts: { secondary: { dmPolicy: "allowlist" } },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GoogleChat
// ---------------------------------------------------------------------------

describe("GoogleChatDmSchema – dmPolicy / allowFrom enforcement", () => {
  it('rejects policy="open" without allowFrom "*"', () => {
    const result = GoogleChatDmSchema.safeParse({
      policy: "open",
      allowFrom: ["user@example.com"],
    });
    expect(result.success).toBe(false);
  });

  it('accepts policy="open" with allowFrom ["*"]', () => {
    const result = GoogleChatDmSchema.safeParse({
      policy: "open",
      allowFrom: ["*"],
    });
    expect(result.success).toBe(true);
  });

  it('accepts policy="pairing" with no allowFrom (default)', () => {
    const result = GoogleChatDmSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.policy).toBe("pairing");
    }
  });
});

describe("GoogleChatConfigSchema", () => {
  it("accepts a minimal GoogleChat config", () => {
    const result = GoogleChatConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts nested group configs", () => {
    const result = GoogleChatConfigSchema.safeParse({
      groups: {
        "space-abc": { enabled: true, requireMention: true },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groups?.["space-abc"]?.enabled).toBe(true);
    }
  });

  it("rejects unknown fields in accounts entries (strict base)", () => {
    const result = GoogleChatConfigSchema.safeParse({
      accounts: { main: { bogus: true } },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

describe("SlackConfigSchema – dmPolicy / allowFrom enforcement", () => {
  it('rejects dmPolicy="open" without "*" in allowFrom', () => {
    const result = SlackConfigSchema.safeParse({
      dmPolicy: "open",
      botToken: "xoxb-fake",
      appToken: "xapp-fake",
      allowFrom: ["U123"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("allowFrom"))).toBe(true);
    }
  });

  it('accepts dmPolicy="open" with allowFrom ["*"]', () => {
    const result = SlackConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["*"],
      botToken: "xoxb-fake",
      appToken: "xapp-fake",
    });
    expect(result.success).toBe(true);
  });

  it('rejects dmPolicy="allowlist" without any allowFrom entries', () => {
    const result = SlackConfigSchema.safeParse({
      dmPolicy: "allowlist",
      botToken: "xoxb-fake",
      appToken: "xapp-fake",
    });
    expect(result.success).toBe(false);
  });

  it("defaults to socket mode when mode is unspecified", () => {
    const result = SlackConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe("socket");
    }
  });

  it("normalises Slack streamMode into nativeStreaming/streaming", () => {
    const result = SlackConfigSchema.safeParse({
      streamMode: "append",
      botToken: "xoxb-fake",
      appToken: "xapp-fake",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.streamMode).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

describe("SignalConfigSchema – dmPolicy / allowFrom enforcement", () => {
  it('rejects dmPolicy="open" without allowFrom "*"', () => {
    const result = SignalConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["+15550001111"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("allowFrom"))).toBe(true);
    }
  });

  it('accepts dmPolicy="open" with allowFrom ["*"]', () => {
    const result = SignalConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["*"],
    });
    expect(result.success).toBe(true);
  });

  it('accepts dmPolicy="pairing" with no allowFrom (default)', () => {
    const result = SignalConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dmPolicy).toBe("pairing");
    }
  });

  it("account with allowlist inherits parent allowFrom", () => {
    const result = SignalConfigSchema.safeParse({
      allowFrom: ["+15559998888"],
      accounts: { work: { dmPolicy: "allowlist" } },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IRC
// ---------------------------------------------------------------------------

describe("IrcNickServSchema", () => {
  it("accepts a minimal nickserv config", () => {
    const result = IrcNickServSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a fully specified nickserv config", () => {
    const result = IrcNickServSchema.safeParse({
      enabled: true,
      service: "NickServ",
      register: true,
      registerEmail: "bot@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown fields (strict mode)", () => {
    const result = IrcNickServSchema.safeParse({ ghostKill: true });
    expect(result.success).toBe(false);
  });
});

describe("IrcAccountSchema – nickserv register requires email", () => {
  it("rejects nickserv.register=true without registerEmail", () => {
    const result = IrcAccountSchema.safeParse({
      nickserv: { register: true },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("registerEmail"))).toBe(true);
    }
  });

  it("accepts nickserv.register=true with a non-empty registerEmail", () => {
    const result = IrcAccountSchema.safeParse({
      nickserv: { register: true, registerEmail: "bot@example.com" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts nickserv.register=false without registerEmail", () => {
    const result = IrcAccountSchema.safeParse({
      nickserv: { register: false },
    });
    expect(result.success).toBe(true);
  });
});

describe("IrcConfigSchema – dmPolicy / allowFrom + nickserv enforcement", () => {
  it('rejects dmPolicy="open" without allowFrom "*"', () => {
    const result = IrcConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["alice!ident@example.org"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("allowFrom"))).toBe(true);
    }
  });

  it('accepts dmPolicy="open" with allowFrom ["*"]', () => {
    const result = IrcConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["*"],
    });
    expect(result.success).toBe(true);
  });

  it("account allowlist uses parent allowFrom when own is absent", () => {
    const result = IrcConfigSchema.safeParse({
      allowFrom: ["trusted-nick"],
      accounts: { libera: { dmPolicy: "allowlist" } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects top-level nickserv.register without registerEmail", () => {
    const result = IrcConfigSchema.safeParse({
      nickserv: { register: true },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("registerEmail"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// iMessage
// ---------------------------------------------------------------------------

describe("IMessageConfigSchema – dmPolicy / allowFrom enforcement", () => {
  it('rejects dmPolicy="open" without allowFrom "*"', () => {
    const result = IMessageConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["alice"],
    });
    expect(result.success).toBe(false);
  });

  it('accepts dmPolicy="open" with allowFrom ["*"]', () => {
    const result = IMessageConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["*"],
    });
    expect(result.success).toBe(true);
  });

  it('accepts dmPolicy="pairing" (default) with no allowFrom', () => {
    const result = IMessageConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dmPolicy).toBe("pairing");
    }
  });

  it("account allowlist validation uses effective (merged) allowFrom", () => {
    const result = IMessageConfigSchema.safeParse({
      allowFrom: ["alice"],
      accounts: { personal: { dmPolicy: "allowlist" } },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BlueBubbles
// ---------------------------------------------------------------------------

describe("BlueBubblesConfigSchema – dmPolicy / allowFrom enforcement", () => {
  it('rejects dmPolicy="allowlist" without allowFrom', () => {
    const result = BlueBubblesConfigSchema.safeParse({ dmPolicy: "allowlist" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("allowFrom"))).toBe(true);
    }
  });

  it('accepts dmPolicy="allowlist" with at least one allowFrom entry', () => {
    const result = BlueBubblesConfigSchema.safeParse({
      dmPolicy: "allowlist",
      allowFrom: ["+15550001111"],
    });
    expect(result.success).toBe(true);
  });

  it('accepts dmPolicy="open" with allowFrom ["*"]', () => {
    const result = BlueBubblesConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["*"],
    });
    expect(result.success).toBe(true);
  });

  it("account allowlist inherits parent allowFrom", () => {
    const result = BlueBubblesConfigSchema.safeParse({
      allowFrom: ["bob"],
      accounts: { main: { dmPolicy: "allowlist" } },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MS Teams
// ---------------------------------------------------------------------------

describe("MSTeamsConfigSchema – dmPolicy / allowFrom enforcement", () => {
  it('rejects dmPolicy="open" without allowFrom "*"', () => {
    const result = MSTeamsConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["user@example.com"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("allowFrom"))).toBe(true);
    }
  });

  it('accepts dmPolicy="open" with allowFrom ["*"]', () => {
    const result = MSTeamsConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["*"],
    });
    expect(result.success).toBe(true);
  });

  it('accepts dmPolicy="pairing" (default) with no allowFrom', () => {
    const result = MSTeamsConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dmPolicy).toBe("pairing");
    }
  });

  it("accepts nested teams and channels config", () => {
    const result = MSTeamsConfigSchema.safeParse({
      teams: {
        "team-abc": {
          requireMention: true,
          channels: {
            "channel-1": { requireMention: false },
          },
        },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teams?.["team-abc"]?.requireMention).toBe(true);
      expect(result.data.teams?.["team-abc"]?.channels?.["channel-1"]?.requireMention).toBe(false);
    }
  });
});
