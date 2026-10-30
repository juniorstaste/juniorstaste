export const PRIMARY_TAB_ORDER = ["for-you", "map", "list", "saved"] as const;

export type PrimaryTab = (typeof PRIMARY_TAB_ORDER)[number];
export type SwipeDirection = "left" | "right";

export const ROOT_TAB_SWIPE_EVENT = "jt-root-tab-swipe";
export const SAVED_SUBTAB_SWIPE_EVENT = "jt-saved-subtab-swipe";
export const TAB_SWIPE_COMPLETE_EVENT = "jt-tab-swipe-complete";
