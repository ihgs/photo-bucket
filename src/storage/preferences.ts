import { DEFAULT_PREFERENCES, type Preferences } from "../domain/types";
import { getDb, withQuotaGuard } from "./db";

const KEY = "preferences";

export const getPreferences = async (): Promise<Preferences> => {
  const stored = (await (await getDb()).get("meta", KEY)) as Partial<Preferences> | undefined;
  return { ...DEFAULT_PREFERENCES, ...stored };
};

export const updatePreferences = (partial: Partial<Preferences>) =>
  withQuotaGuard(async () => {
    const next = { ...(await getPreferences()), ...partial };
    await (await getDb()).put("meta", next, KEY);
    return next;
  });
