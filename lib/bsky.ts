import { BskyAgent } from "@atproto/api";

let agentPromise: Promise<BskyAgent> | null = null;

export async function getAgent() {
  if (!agentPromise) {
    agentPromise = (async () => {
      const agent = new BskyAgent({ service: process.env.BLUESKY_SERVICE! });
      await agent.login({
        identifier: process.env.BLUESKY_HANDLE!,
        password: process.env.BLUESKY_APP_PASSWORD!, // use app password in dev
      });
      return agent;
    })();
  }
  return agentPromise;
}
