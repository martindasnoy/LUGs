"use client";

import { FormEvent, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Lottie from "lottie-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { type UiLanguage, uiLanguageLabels, uiLanguages, uiTranslations } from "@/lib/i18n/ui";
import legoSpinnerAnimation from "@/Imagenes/Lego Spinner.json";

type Mode = "login" | "register";
type SocialPlatform = "instagram" | "facebook" | "";

type MasterLugItem = {
  lug_id: string;
  nombre: string;
  pais: string | null;
  logo_data_url: string | null;
  color1: string | null;
  open_access: boolean;
  members_count: number;
};

type LugMemberItem = {
  id: string;
  full_name: string;
  avatar_key: string | null;
  social_platform: string | null;
  social_handle: string | null;
  rol_lug: string | null;
};

type MemberChatMessageItem = {
  message_id: string;
  room_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
};

type UnreadChatRoomAlertItem = {
  room_id: string;
  room_type: string;
  room_name: string | null;
  participant_ids: string[];
  peer_user_id: string | null;
  unread_count: number;
  last_message_content: string | null;
  last_message_at: string | null;
};

type LugInfoItem = {
  lug_id: string;
  nombre: string;
  pais: string | null;
  descripcion: string | null;
  logo_data_url: string | null;
  color1: string | null;
  members: LugMemberItem[];
};

type AdminJoinRequestItem = {
  request_id: string;
  requester_id: string;
  lug_id: string;
  full_name: string;
  social_platform: string | null;
  social_handle: string | null;
  request_message: string | null;
  contact_social: string | null;
  created_at: string;
};

type MasterEmptyLugNotificationItem = {
  notification_id: string;
  lug_id: string;
  nombre: string;
  pais: string | null;
  descripcion: string | null;
  created_at: string;
};

type PendingLugAccessAction = {
  type: "request" | "direct";
  lug_id: string;
  lug_name: string;
};

type AppSection = "dashboard" | "listas" | "lista_detalle" | "mi_lug" | "minifiguras" | "configuracion_personal" | "balance_usuario";
type ListaTipo = "deseos" | "venta";
type ListaVisibilidad = "privado" | "publico";

type CollectibleSeriesItem = {
  id: number;
  name: string;
  year_from: number | null;
  year_to: number | null;
  set_count: number;
};

type MinifigFigureItem = {
  set_num: string;
  name: string;
  set_img_url: string | null;
  num_parts: number;
  year: number | null;
  theme_id: number | null;
};

type MinifigFigurePartItem = {
  row_id: string;
  part_num: string;
  part_name: string;
  color_name: string;
  part_img_url: string | null;
  quantity: number;
};

type MinifigMissingAnalysisRow = {
  set_num: string;
  part_num: string;
  part_name: string;
  color_name: string;
  missing_quantity: number;
};

type MinifigMissingAnalysisResult = {
  missingBySetNum: Record<string, boolean>;
  missingPieceCount: number;
  missingRows: MinifigMissingAnalysisRow[];
  hadError: boolean;
};

type MinifigFiguresFilter = "all" | "missing" | "complete" | "favorite";

type ListaItem = {
  id: string;
  nombre: string;
  tipo: ListaTipo;
  piezas: number;
  lotes: number;
  visibilidad: ListaVisibilidad;
};

type PartCategoryItem = {
  id: number;
  name: string;
  part_count: number;
};

type PartCatalogItem = {
  part_num: string;
  name: string;
  part_img_url: string | null;
  category_id: number | null;
  is_printed?: boolean;
};

type GoBrickColorItem = {
  id: number;
  lego: string | null;
  bricklink: string | null;
  lego_available: boolean;
  hex: string | null;
};

const NO_COLOR_LABEL = "Sin color";

function normalizeColorLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function colorMatchesAvailable(optionLabel: string, availableLabels: string[]) {
  const target = normalizeColorLabel(optionLabel);
  return availableLabels.some((name) => {
    const current = normalizeColorLabel(name);
    return current === target || current.includes(target) || target.includes(current);
  });
}

function parseStoredColorLabel(value: string | null) {
  if (!value) {
    return null;
  }

  const clean = String(value).trim();
  if (!clean) {
    return null;
  }

  return clean.replace(/^lego:\s*/i, "").replace(/^bricklink:\s*/i, "").trim() || null;
}

function formatPartLabel(part: Pick<PartCatalogItem, "part_num" | "name">) {
  return `${part.part_num} - ${part.name}`;
}

function normalizeDimensionText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s*x\s*/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function getPartImageKey(partNum: string, colorName: string | null | undefined) {
  const normalizedColor = String(colorName ?? "").trim().toLowerCase();
  return `${partNum.trim()}::${normalizedColor}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getColorHexFromName(colorName: string | null, availableColors: Array<{ name: string; blName?: string; hex: string }>) {
  if (!colorName) return "#d1d5db";
  const normalized = colorName.replace("(Chino)", "").trim().toLowerCase();
  const match = availableColors.find((c) => {
    const lego = c.name.toLowerCase();
    const bl = (c.blName ?? "").trim().toLowerCase();
    return normalized === lego || (bl.length > 0 && normalized === bl);
  });
  const hex = match?.hex ?? "d1d5db";
  return hex.startsWith("#") ? hex : `#${hex}`;
}

function getTextColorForBackground(hex: string) {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#111827";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#111827" : "#ffffff";
}

function buildSocialUrl(platform: string | null, handle: string | null) {
  const cleanHandle = String(handle ?? "").trim();
  if (!cleanHandle) return null;
  if (/^https?:\/\//i.test(cleanHandle)) return cleanHandle;

  const normalizedHandle = cleanHandle.replace(/^@+/, "");
  const normalizedPlatform = String(platform ?? "").trim().toLowerCase();
  if (normalizedPlatform === "instagram") return `https://instagram.com/${normalizedHandle}`;
  if (normalizedPlatform === "facebook") return `https://facebook.com/${normalizedHandle}`;
  return null;
}

function getSocialPlatformLabel(platform: string | null) {
  const normalizedPlatform = String(platform ?? "").trim().toLowerCase();
  if (normalizedPlatform === "instagram") {
    return { logo: "IG", bg: "#ec4899" };
  }
  if (normalizedPlatform === "facebook") {
    return { logo: "f", bg: "#2563eb" };
  }
  return { logo: "@", bg: "#64748b" };
}

function getMinifigPartInventoryKey(setNum: string, partNum: string, colorName: string) {
  return `${setNum}::${partNum}::${colorName}`;
}

function getMissingMinifigPartRows(rows: MinifigFigurePartItem[], checkedByRowId: Record<string, boolean>) {
  return rows.filter((row) => checkedByRowId[row.row_id] === false);
}

type ListPartItem = {
  item_id: string;
  part_num: string | null;
  part_name: string | null;
  color_name: string | null;
  imgmatchcolor: boolean;
  display_color_label: string | null;
  part_img_url: string | null;
  quantity: number;
  value: number | null;
};

type Lot = {
  id: string;
  part_num: string;
  part_name: string;
  color_name: string | null;
  quantity: number;
  value?: number | null;
};

type PartImageLookup = Record<string, string | null>;

type MiLugPoolItem = {
  id: string;
  part_num: string;
  part_name: string;
  part_img_url: string | null;
  color_label: string | null;
  list_type: "deseos" | "venta";
  publisher_id: string;
  quantity: number;
  requested_quantity: number;
  remaining_quantity: number;
  current_user_offer_quantity: number;
  value: number | null;
  publisher_name: string;
  imgmatchcolor: boolean;
};

type WishlistOfferDetail = {
  offer_id: string;
  list_item_id: string;
  requester_id: string;
  requester_name: string;
  quantity: number;
};

type OfferSummaryRow = {
  id: string;
  userName: string;
  partLabel: string;
  quantity: number;
};

type CategoriesPanelMode = "categories" | "parts";
type CategoryQuickFilter = "all" | "popular" | "minifig" | "technic" | "otros";

type RolLug = "admin" | "common" | null;

function getSectionFromPath(pathname: string): AppSection | null {
  const clean = String(pathname || "").trim().toLowerCase();
  if (clean === "/" || clean === "/dashboard") {
    return "dashboard";
  }
  if (clean === "/listas") {
    return "listas";
  }
  if (clean === "/mi-lug") {
    return "mi_lug";
  }
  if (clean === "/minifiguras") {
    return "minifiguras";
  }
  if (clean === "/configuracion-personal") {
    return "configuracion_personal";
  }
  return null;
}

const FACE_TOTAL = 20;
const AUTO_MINIFIG_MISSING_LIST_NAME = "Faltantes de CMF";
const DEFAULT_LOADING_PHRASES = [
  "Clasificando piezas",
  "Desarmando sets",
  "Creando MOCs",
  "Armando minifiguras",
  "Pegando stickers en un quesito",
];
const SECTION_DATA_CACHE_MS = 45_000;

type HomeProps = {
  initialSection?: AppSection;
  initialListId?: string;
};

export default function Home({ initialSection, initialListId }: HomeProps = {}) {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [language, setLanguage] = useState<UiLanguage>(() => {
    if (typeof window === "undefined") {
      return "es";
    }

    const stored = window.localStorage.getItem("ui_language");
    return stored === "en" || stored === "pt" ? stored : "es";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [authCooldownUntil, setAuthCooldownUntil] = useState<number>(0);
  const [authNowMs, setAuthNowMs] = useState<number>(() => Date.now());
  const [appBootLoading, setAppBootLoading] = useState(true);
  const [loadingPhrases, setLoadingPhrases] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_LOADING_PHRASES;
    }

    try {
      const raw = window.localStorage.getItem("loading_phrases_v1");
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (!Array.isArray(parsed)) {
        return DEFAULT_LOADING_PHRASES;
      }

      const normalized = parsed
        .slice(0, DEFAULT_LOADING_PHRASES.length)
        .map((item) => String(item ?? "").trim());

      return DEFAULT_LOADING_PHRASES.map((fallback, index) => normalized[index] || fallback);
    } catch {
      return DEFAULT_LOADING_PHRASES;
    }
  });
  const [loadingPhrase, setLoadingPhrase] = useState(DEFAULT_LOADING_PHRASES[0]);
  const [loadingPhrasesDraft, setLoadingPhrasesDraft] = useState<string[]>(DEFAULT_LOADING_PHRASES);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessageLine1, setMaintenanceMessageLine1] = useState("Estamos en mantenimiento");
  const [maintenanceMessageLine2, setMaintenanceMessageLine2] = useState("Volvé en un rato");
  const [footerLegend, setFooterLegend] = useState("LUGs App");
  const [dashboardSectionBalanceEnabled, setDashboardSectionBalanceEnabled] = useState(true);
  const [dashboardSectionListasEnabled, setDashboardSectionListasEnabled] = useState(true);
  const [dashboardSectionSetsEnabled, setDashboardSectionSetsEnabled] = useState(true);
  const [dashboardSectionMinifigEnabled, setDashboardSectionMinifigEnabled] = useState(true);
  const [showMaintenancePanel, setShowMaintenancePanel] = useState(false);
  const [maintenanceDraftMessageLine1, setMaintenanceDraftMessageLine1] = useState("");
  const [maintenanceDraftMessageLine2, setMaintenanceDraftMessageLine2] = useState("");
  const [maintenanceDraftFooterLegend, setMaintenanceDraftFooterLegend] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentLugId, setCurrentLugId] = useState<string | null>(null);
  const [rolLug, setRolLug] = useState<RolLug>(null);
  const [displayName, setDisplayName] = useState("Usuario");
  const [isMaster, setIsMaster] = useState(false);

  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showLanguagePickerPopup, setShowLanguagePickerPopup] = useState(false);
  const [languageChanging, setLanguageChanging] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNameInput, setSettingsNameInput] = useState("");
  const [settingsEmailInput, setSettingsEmailInput] = useState("");
  const [settingsLanguageInput, setSettingsLanguageInput] = useState<UiLanguage>("es");
  const [settingsLugName, setSettingsLugName] = useState("Sin LUG");
  const [settingsLugId, setSettingsLugId] = useState<string | null>(null);
  const [settingsSocialPlatform, setSettingsSocialPlatform] = useState<SocialPlatform>("instagram");
  const [settingsSocialHandle, setSettingsSocialHandle] = useState("");
  const [settingsBricksetUserHash, setSettingsBricksetUserHash] = useState("");
  const [settingsBricksetUsername, setSettingsBricksetUsername] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [settingsPasswordInput, setSettingsPasswordInput] = useState("");
  const [settingsPasswordConfirmInput, setSettingsPasswordConfirmInput] = useState("");
  const [showDeleteUserConfirmPopup, setShowDeleteUserConfirmPopup] = useState(false);
  const [deletingUserAccount, setDeletingUserAccount] = useState(false);
  const [selectedFace, setSelectedFace] = useState(1);
  const [showFacePicker, setShowFacePicker] = useState(false);
  const [previewFace, setPreviewFace] = useState(1);
  const [showMasterPanel, setShowMasterPanel] = useState(false);
  const [showLoadingPhrasesPanel, setShowLoadingPhrasesPanel] = useState(false);
  const [showLugsPanel, setShowLugsPanel] = useState(false);
  const [showCreateLugPanel, setShowCreateLugPanel] = useState(false);
  const [createLugFromListFlow, setCreateLugFromListFlow] = useState(false);
  const [showCreateLugConfirmPanel, setShowCreateLugConfirmPanel] = useState(false);
  const [showLugAccessConfirmPanel, setShowLugAccessConfirmPanel] = useState(false);
  const [pendingLugAccessAction, setPendingLugAccessAction] = useState<PendingLugAccessAction | null>(null);
  const [creatingLug, setCreatingLug] = useState(false);
  const [lugNombre, setLugNombre] = useState("");
  const [lugPais, setLugPais] = useState("");
  const [lugDescripcion, setLugDescripcion] = useState("");
  const [lugColor1, setLugColor1] = useState("#006eb2");
  const [lugColor2, setLugColor2] = useState("#ffffff");
  const [lugColor3, setLugColor3] = useState("#111111");
  const [lugLogoDataUrl, setLugLogoDataUrl] = useState<string | null>(null);
  const [lugLogoFile, setLugLogoFile] = useState<File | null>(null);
  const [lugLogoError, setLugLogoError] = useState("");
  const [masterLugs, setMasterLugs] = useState<MasterLugItem[]>([]);
  const [masterLugsLoading, setMasterLugsLoading] = useState(false);
  const [showSettingsLugPanel, setShowSettingsLugPanel] = useState(false);
  const [settingsLugPanelLoading, setSettingsLugPanelLoading] = useState(false);
  const [settingsLugSaving, setSettingsLugSaving] = useState(false);
  const [settingsLugNombreInput, setSettingsLugNombreInput] = useState("");
  const [settingsLugPaisInput, setSettingsLugPaisInput] = useState("");
  const [settingsLugDescripcionInput, setSettingsLugDescripcionInput] = useState("");
  const [settingsLugColor1Input, setSettingsLugColor1Input] = useState("#006eb2");
  const [settingsLugColor2Input, setSettingsLugColor2Input] = useState("#ffffff");
  const [settingsLugColor3Input, setSettingsLugColor3Input] = useState("#111111");
  const [settingsLugLogoDataUrl, setSettingsLugLogoDataUrl] = useState<string | null>(null);
  const [settingsLugLogoFile, setSettingsLugLogoFile] = useState<File | null>(null);
  const [settingsLugLogoError, setSettingsLugLogoError] = useState("");
  const [showLugInfoPanel, setShowLugInfoPanel] = useState(false);
  const [lugInfoLoading, setLugInfoLoading] = useState(false);
  const [lugInfoData, setLugInfoData] = useState<LugInfoItem | null>(null);
  const [requestedLugIds, setRequestedLugIds] = useState<string[]>([]);
  const [requestActionLoadingLugId, setRequestActionLoadingLugId] = useState<string | null>(null);
  const [adminPendingRequestsCount, setAdminPendingRequestsCount] = useState(0);
  const [showAdminRequestsPanel, setShowAdminRequestsPanel] = useState(false);
  const [adminRequestsLoading, setAdminRequestsLoading] = useState(false);
  const [adminRequests, setAdminRequests] = useState<AdminJoinRequestItem[]>([]);
  const [showJoinRequestFormPanel, setShowJoinRequestFormPanel] = useState(false);
  const [joinRequestTargetLugId, setJoinRequestTargetLugId] = useState<string | null>(null);
  const [joinRequestTargetLugName, setJoinRequestTargetLugName] = useState("");
  const [joinRequestMessageInput, setJoinRequestMessageInput] = useState("");
  const [joinRequestSocialInput, setJoinRequestSocialInput] = useState("");
  const [joinRequestSending, setJoinRequestSending] = useState(false);
  const [showAdminRequestDetailPanel, setShowAdminRequestDetailPanel] = useState(false);
  const [selectedAdminRequest, setSelectedAdminRequest] = useState<AdminJoinRequestItem | null>(null);
  const [adminDecisionLoading, setAdminDecisionLoading] = useState(false);
  const [promoteMemberLoadingId, setPromoteMemberLoadingId] = useState<string | null>(null);
  const [memberChatLoadingId, setMemberChatLoadingId] = useState<string | null>(null);
  const [showMemberChatPopup, setShowMemberChatPopup] = useState(false);
  const [selectedMemberChat, setSelectedMemberChat] = useState<{ roomId: string; memberId: string; memberName: string } | null>(null);
  const [memberChatMessages, setMemberChatMessages] = useState<MemberChatMessageItem[]>([]);
  const [memberChatLoading, setMemberChatLoading] = useState(false);
  const [memberChatInput, setMemberChatInput] = useState("");
  const [memberChatSending, setMemberChatSending] = useState(false);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [showUnreadChatsPopup, setShowUnreadChatsPopup] = useState(false);
  const [unreadChatsPopupLoading, setUnreadChatsPopupLoading] = useState(false);
  const [unreadChatsRooms, setUnreadChatsRooms] = useState<UnreadChatRoomAlertItem[]>([]);
  const [unreadChatNameByUserId, setUnreadChatNameByUserId] = useState<Record<string, string>>({});
  const [masterEmptyNotificationsCount, setMasterEmptyNotificationsCount] = useState(0);
  const [showMasterEmptyLugsPanel, setShowMasterEmptyLugsPanel] = useState(false);
  const [masterEmptyLugsLoading, setMasterEmptyLugsLoading] = useState(false);
  const [masterEmptyLugs, setMasterEmptyLugs] = useState<MasterEmptyLugNotificationItem[]>([]);
  const [masterLugActionLoadingId, setMasterLugActionLoadingId] = useState<string | null>(null);
  const [currentLugColor1, setCurrentLugColor1] = useState("#006eb2");
  const [currentLugColor2, setCurrentLugColor2] = useState("#ffffff");
  const [currentLugColor3, setCurrentLugColor3] = useState("#111111");
  const [currentLugLogoDataUrl, setCurrentLugLogoDataUrl] = useState<string | null>(null);
  const [legacyLogosBackfillRunning, setLegacyLogosBackfillRunning] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>(() => {
    if (initialSection) {
      return initialSection;
    }

    if (typeof window === "undefined") {
      return "dashboard";
    }

    const stored = window.localStorage.getItem("active_section_v1");
    if (stored === "listas" || stored === "lista_detalle" || stored === "mi_lug" || stored === "minifiguras" || stored === "configuracion_personal") {
      return stored;
    }
    return "dashboard";
  });
  const navigateSectionClient = useCallback((section: AppSection, path: string) => {
    startTransition(() => {
      setActiveSection(section);
    });
    if (typeof window === "undefined") {
      return;
    }
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
  }, []);
  const [minifigSeriesRows, setMinifigSeriesRows] = useState<CollectibleSeriesItem[]>([]);
  const [minifigSeriesLoading, setMinifigSeriesLoading] = useState(false);
  const [minifigSeriesCheckedById, setMinifigSeriesCheckedById] = useState<Record<number, boolean>>({});
  const [minifigSeriesFavoriteById, setMinifigSeriesFavoriteById] = useState<Record<number, boolean>>({});
  const [showOnlyFavoriteSeries, setShowOnlyFavoriteSeries] = useState(false);
  const [minifigSeriesProgressById, setMinifigSeriesProgressById] = useState<Record<number, { owned: number; total: number }>>({});
  const [showMinifigSeriesPopup, setShowMinifigSeriesPopup] = useState(false);
  const [minifigFiguresBySeriesId, setMinifigFiguresBySeriesId] = useState<Record<number, MinifigFigureItem[]>>({});
  const [minifigFiguresLoadingBySeriesId, setMinifigFiguresLoadingBySeriesId] = useState<Record<number, boolean>>({});
  const [minifigFigureCheckedBySetNum, setMinifigFigureCheckedBySetNum] = useState<Record<string, boolean>>({});
  const [minifigFigureFavoriteBySetNum, setMinifigFigureFavoriteBySetNum] = useState<Record<string, boolean>>({});
  const [showOnlyFavoriteFigures, setShowOnlyFavoriteFigures] = useState(false);
  const [minifigFiguresFilter, setMinifigFiguresFilter] = useState<MinifigFiguresFilter>("all");
  const [minifigSearchQuery, setMinifigSearchQuery] = useState("");
  const [minifigSearchResults, setMinifigSearchResults] = useState<MinifigFigureItem[]>([]);
  const [minifigSearchLoading, setMinifigSearchLoading] = useState(false);
  const [minifigMissingWishlistSyncing, setMinifigMissingWishlistSyncing] = useState(false);
  const [selectedMinifigForImagePopup, setSelectedMinifigForImagePopup] = useState<MinifigFigureItem | null>(null);
  const [showMinifigPartsPopup, setShowMinifigPartsPopup] = useState(false);
  const [selectedMinifigForParts, setSelectedMinifigForParts] = useState<MinifigFigureItem | null>(null);
  const [minifigPartsRows, setMinifigPartsRows] = useState<MinifigFigurePartItem[]>([]);
  const [minifigPartsLoading, setMinifigPartsLoading] = useState(false);
  const [minifigPartCheckedByRowId, setMinifigPartCheckedByRowId] = useState<Record<string, boolean>>({});
  const [minifigSetHasMissingPartsBySetNum, setMinifigSetHasMissingPartsBySetNum] = useState<Record<string, boolean>>({});
  const [minifigMissingPartsPreviewBySetNum, setMinifigMissingPartsPreviewBySetNum] = useState<Record<string, MinifigFigurePartItem[]>>({});
  const [minifigMissingPartsPreviewLoadingBySetNum, setMinifigMissingPartsPreviewLoadingBySetNum] = useState<Record<string, boolean>>({});
  const [minifigGlobalOwnedStats, setMinifigGlobalOwnedStats] = useState({ complete: 0, missing: 0, total: 0, favorites: 0 });
  const [minifigGlobalMissingPiecesCount, setMinifigGlobalMissingPiecesCount] = useState(0);
  const [showCreateListaPanel, setShowCreateListaPanel] = useState(false);
  const [newListaTipo, setNewListaTipo] = useState<ListaTipo>("deseos");
  const [newListaNombre, setNewListaNombre] = useState("");
  const [listasItems, setListasItems] = useState<ListaItem[]>([]);
  const [listasLoading, setListasLoading] = useState(false);
  const [listasSaving, setListasSaving] = useState(false);
  const [dashboardListsCreatedCount, setDashboardListsCreatedCount] = useState(0);
  const [showDeleteListaConfirmPanel, setShowDeleteListaConfirmPanel] = useState(false);
  const [listaToDelete, setListaToDelete] = useState<ListaItem | null>(null);
  const [selectedListForItems, setSelectedListForItems] = useState<ListaItem | null>(null);
  const [listItemsLoading, setListItemsLoading] = useState(false);
  const [listItemsRows, setListItemsRows] = useState<ListPartItem[]>([]);
  const [listItemsPage, setListItemsPage] = useState(1);
  const [partsCategories, setPartsCategories] = useState<PartCategoryItem[]>([]);
  const listasLastLoadedAtRef = useRef(0);
  const partCategoriesLastLoadedAtRef = useRef(0);
  const minifigSeriesLastLoadedAtRef = useRef(0);
  const [partsSearchQuery, setPartsSearchQuery] = useState("");
  const [partsSearchResults, setPartsSearchResults] = useState<PartCatalogItem[]>([]);
  const [partsSearchLoading, setPartsSearchLoading] = useState(false);
  const [showPartSearchDropdown, setShowPartSearchDropdown] = useState(false);
  const [goBrickColors, setGoBrickColors] = useState<GoBrickColorItem[]>([]);
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false);
  const [categoriesPanelMode, setCategoriesPanelMode] = useState<CategoriesPanelMode>("categories");
  const [categoryQuickFilter, setCategoryQuickFilter] = useState<CategoryQuickFilter>("popular");
  const [selectedPanelCategory, setSelectedPanelCategory] = useState<PartCategoryItem | null>(null);
  const [panelPartsPage, setPanelPartsPage] = useState(1);
  const [panelPartsLoading, setPanelPartsLoading] = useState(false);
  const [panelPartsResults, setPanelPartsResults] = useState<PartCatalogItem[]>([]);
  const [panelPrintFilters, setPanelPrintFilters] = useState<{ no_printed: boolean; printed: boolean }>({
    no_printed: true,
    printed: false,
  });
  const [selectedPanelPartNum, setSelectedPanelPartNum] = useState<string | null>(null);
  const [showRenameListaPanel, setShowRenameListaPanel] = useState(false);
  const [listaToRename, setListaToRename] = useState<ListaItem | null>(null);
  const [renameListaInput, setRenameListaInput] = useState("");
  const [addItemColorMode, setAddItemColorMode] = useState<"bricklink" | "lego">("bricklink");
  const [addItemColorNameInput, setAddItemColorNameInput] = useState(NO_COLOR_LABEL);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [addItemColorExists, setAddItemColorExists] = useState(true);
  const [partAvailableColorNames, setPartAvailableColorNames] = useState<string[]>([]);
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [addItemPriceInput, setAddItemPriceInput] = useState("");
  const [selectedSearchPartNum, setSelectedSearchPartNum] = useState<string | null>(null);
  const [selectedPartColorImageUrl, setSelectedPartColorImageUrl] = useState<string | null>(null);
  const [selectedPartColorImageMissing, setSelectedPartColorImageMissing] = useState(false);
  const [itemQuantityInputs, setItemQuantityInputs] = useState<Record<string, string>>({});
  const [itemPriceInputs, setItemPriceInputs] = useState<Record<string, string>>({});
  const [miLugPoolWishlistItems, setMiLugPoolWishlistItems] = useState<MiLugPoolItem[]>([]);
  const [miLugPoolSaleItems, setMiLugPoolSaleItems] = useState<MiLugPoolItem[]>([]);
  const [miLugHeaderName, setMiLugHeaderName] = useState<string | null>(null);
  const [miLugHeaderLogo, setMiLugHeaderLogo] = useState<string | null>(null);
  const [miLugWishlistSort, setMiLugWishlistSort] = useState<"codigo" | "color" | "usuario">("codigo");
  const [miLugSaleSort, setMiLugSaleSort] = useState<"codigo" | "color" | "usuario" | "price_asc" | "price_desc">("codigo");
  const [hideOwnPoolItems, setHideOwnPoolItems] = useState(true);
  const [miLugWishlistPage, setMiLugWishlistPage] = useState(1);
  const [miLugSalePage, setMiLugSalePage] = useState(1);
  const [miLugMembersPage, setMiLugMembersPage] = useState(1);
  const [showMiLugWishlistPoolPanel, setShowMiLugWishlistPoolPanel] = useState(false);
  const [showMiLugSalesPoolPanel, setShowMiLugSalesPoolPanel] = useState(false);
  const [miLugPoolsLoading, setMiLugPoolsLoading] = useState(false);
  const [selectedMiLugPoolItem, setSelectedMiLugPoolItem] = useState<{ type: "wishlist" | "venta"; item: MiLugPoolItem } | null>(null);
  const [miLugOfferQuantityInput, setMiLugOfferQuantityInput] = useState("1");
  const [showMiLugMembersPanel, setShowMiLugMembersPanel] = useState(false);
  const [miLugMembersLoading, setMiLugMembersLoading] = useState(false);
  const [miLugMembersRows, setMiLugMembersRows] = useState<LugMemberItem[]>([]);
  const [selectedMiLugMemberCard, setSelectedMiLugMemberCard] = useState<LugMemberItem | null>(null);
  const [listItemOffersById, setListItemOffersById] = useState<Record<string, WishlistOfferDetail[]>>({});
  const [selectedListItemOffers, setSelectedListItemOffers] = useState<{
    partLabel: string;
    requestedQuantity: number;
    offers: WishlistOfferDetail[];
  } | null>(null);
  const [showOffersGivenPanel, setShowOffersGivenPanel] = useState(false);
  const [showOffersReceivedPanel, setShowOffersReceivedPanel] = useState(false);
  const [offersGivenRows, setOffersGivenRows] = useState<OfferSummaryRow[]>([]);
  const [offersReceivedRows, setOffersReceivedRows] = useState<OfferSummaryRow[]>([]);
  const [offersPanelsLoading, setOffersPanelsLoading] = useState(false);
  const colorDropdownRef = useRef<HTMLDivElement | null>(null);
  const partSearchDropdownRef = useRef<HTMLDivElement | null>(null);
  const memberChatScrollRef = useRef<HTMLDivElement | null>(null);

  const t = useMemo(() => uiTranslations[language], [language]);
  const labels = useMemo(() => {
    if (language === "en") {
      return {
        back: "Back",
        lists: "Lists",
        createList: "Create list",
        yourWishlists: "Your wishlists",
        yourSaleLists: "Your sale lists",
        noWishlistLists: "No wishlist lists.",
        noSaleLists: "No sale lists.",
        renameListTitle: "Rename list",
        private: "Private",
        public: "Public",
        deleteList: "Delete list",
        offeredToOthers: "Parts offered to others",
        offeredToMe: "Parts offered to me",
        print: "Print",
        close: "Close",
        cancel: "Cancel",
        loading: "Loading...",
        noOffersRegistered: "No offers registered.",
        noOffersReceived: "No offers received.",
        members: "Members",
        makeAdmin: "Make Admin",
        loadingMembers: "Loading members...",
        noMembers: "No members to display.",
        poolWishlist: "Wishlist Pool",
        poolSales: "Sales Pool",
        noPublicWishlist: "No public parts in wishlist.",
        noPublicSales: "No public parts for sale.",
        iHave: "I have it",
        minifigPending: "Minifigures in preparation.",
        userSettings: "User settings",
        name: "Name",
        mail: "Email",
        changePassword: "Change password",
        hidePasswordChange: "Hide password change",
        newPassword: "New password",
        repeatPassword: "Repeat password",
        lug: "LUG",
        socialNetwork: "Social network",
        none: "None",
        userPlaceholder: "user",
        doubleClickSelect: "Double click to select",
        save: "Save",
        saving: "Saving...",
        lugProperties: "LUG properties",
        lugInformation: "LUG information",
        loadingLugInfo: "Loading LUG information...",
        noLug: "No LUG",
        noName: "No name",
        noCountry: "No country",
        noDescription: "No description",
        lugsList: "LUG list",
        mustJoinOrCreateLug: "You must join or create a LUG to continue.",
        doubleClickLugInfo: "Double click a LUG to view details.",
        loadingLugs: "Loading LUGs...",
        noLugsLoaded: "No LUGs loaded.",
        yourLug: "Your LUG",
        noOtherLugs: "No other LUGs to show.",
        membersSuffix: "members",
        enterDirect: "Enter directly",
        cancelRequest: "Cancel request",
        requestJoin: "Request access",
        createNewLug: "Create new LUG",
        requestJoinTitle: "Request access",
        writeMessage: "Write a message",
        send: "Send",
        sending: "Sending...",
        lugInfoTitle: "LUG information",
        loadingInfo: "Loading information...",
        noMembersLoaded: "No members loaded.",
        noSocial: "No social network",
        noLugDetail: "Could not load LUG detail.",
        joinRequestsTitle: "Join requests",
        loadingJoinRequests: "Loading requests...",
        noPendingRequests: "No pending requests.",
        emptyLugsTitle: "Empty LUGs",
        loadingEmptyLugs: "Loading empty LUGs...",
        noPendingEmptyLugs: "No pending empty LUGs.",
        deleteLug: "Delete LUG",
        leaveOpen: "Leave open",
        addItem: "Add item",
        categories: "Categories",
        noImage: "No image",
        searchPlaceholder: "Search part by name, code or #code",
        searching: "Searching...",
        noResults: "No results.",
        loadingList: "Loading list...",
        loadingParts: "Loading parts...",
        noCategoriesToShow: "No categories to show. First sync the catalog.",
        wishlistListType: "Wishlist",
        saleListType: "Sale list",
        listNamePlaceholder: "List name",
        renameList: "Rename list",
        yes: "Yes",
        no: "No",
        deleteListConfirm: "Are you sure you want to delete the list? Information about all parts inside will be lost.",
        price: "Price",
        itemsOfList: "List items",
        listHasNoPartsYet: "This list has no parts yet.",
        someoneOffersThisPart: "Someone offers you this part",
        catalog: "Catalog",
        noPartsToShow: "No parts to show.",
        sortCode: "Code",
        sortColor: "Color",
        sortUser: "User",
        sortPriceAsc: "$ low to high",
        sortPriceDesc: "$ high to low",
        masterPanel: "Master Panel",
        createLug: "Create LUG",
        doubleClickAssignLug: "Double click a LUG to set it as current.",
        loadingPhrasesTitle: "Loading phrases",
        loadingPhrasesHelp: "Edit and save phrases. They will apply in future loads.",
        maintenanceLockTitle: "Maintenance lock",
        enableMaintenance: "Enable maintenance",
        maintenanceLine1: "Line 1 phrase",
        maintenanceLine2: "Line 2 phrase",
        maintenanceLine1Placeholder: "Write the first line",
        maintenanceLine2Placeholder: "Write the second line",
        preview: "Preview",
        switchLug: "Switch LUG",
        uploadLogoMax: "Upload logo image (max 500x500)",
        countryCity: "Country / city",
        description: "Description",
        creating: "Creating...",
        createNewLugShort: "Create new LUG",
        createLugButton: "Create LUG",
        leaveCurrentLugOnCreate: "If you continue, you will leave your current LUG.",
        leaveCurrentLugOnAccess: "If you continue, you will leave your current LUG.",
        ok: "OK",
        loadingListById: "Loading list...",
        noMail: "No email",
        noColor: "No color",
        noNameFallback: "No name",
        noImageCache: "Image not cached",
        notLegoColor: "(Not LEGO color)",
        backToCategories: "Back to categories",
        notPrinted: "Not printed",
        printed: "Printed",
        filterAll: "All",
        filterPopular: "Popular",
        filterOthers: "Others",
        maintenanceSection: "Maintenance",
        disableMaintenance: "Disable maintenance",
        noMessage: "No message",
        reject: "Reject",
        accept: "Accept",
        offerLine: (name: string, qty: number) => `${name} offers you ${qty} pieces`,
        existingColorPart: "part in existing color",
        logo: "Logo",
        color1: "Color1",
        color2: "Color2",
        color3: "Color3",
        exportUser: "User",
        exportMail: "Email",
        exportDate: "Date",
        exportPiece: "Part",
        exportQuantity: "Quantity",
        exportImage: "Image",
        exportName: "Name",
        exportColor: "Color",
        buttonLists: "LISTS",
        buttonMinifig: "minifigures",
        buttonLugs: "LUGs",
        detailSale: "Sale detail",
        detailWishlist: "Wishlist detail",
        quantityWord: "Quantity",
        publishedByWord: "Published by",
        selectColor: "Select color",
        exportPdf: "Export to PDF",
        listLotsCount: "Lots quantity",
        listPiecesCount: "Pieces quantity",
        footerLegendLabel: "Footer legend",
        footerLegendPlaceholder: "Write footer text",
        footerLegendSave: "Save legend",
        minifigSectionTitle: "Minifigures",
        collectibleSeriesTitle: "Collectible series",
        loadingSeries: "Loading series...",
        noSeriesFound: "No collectible series found.",
        selectSeriesHint: "Select a series to continue.",
        syncMinifigSeries: "Sync minifig series",
        loadingSeriesItems: "Loading figures...",
        noSeriesItems: "No figures in this series.",
        loadingFigureParts: "Loading parts...",
        noFigureParts: "No parts for this figure.",
        ownedComplete: "Complete",
        ownedMissing: "Missing parts",
        ownedTotal: "Owned",
        ownedFavorites: "Favorites",
      };
    }

    if (language === "pt") {
      return {
        back: "Voltar",
        lists: "Listas",
        createList: "Criar lista",
        yourWishlists: "Suas wishlists",
        yourSaleLists: "Suas listas de venda",
        noWishlistLists: "Sem listas de wishlist.",
        noSaleLists: "Sem listas de venda.",
        renameListTitle: "Renomear lista",
        private: "Privado",
        public: "Publico",
        deleteList: "Excluir lista",
        offeredToOthers: "Pecas oferecidas a outros",
        offeredToMe: "Pecas que me ofereceram",
        print: "Imprimir",
        close: "Fechar",
        cancel: "Cancelar",
        loading: "Carregando...",
        noOffersRegistered: "Sem ofertas registradas.",
        noOffersReceived: "Sem ofertas recebidas.",
        members: "Integrantes",
        makeAdmin: "Tornar Admin",
        loadingMembers: "Carregando integrantes...",
        noMembers: "Sem integrantes para mostrar.",
        poolWishlist: "Pool de Wishlist",
        poolSales: "Pool de Vendas",
        noPublicWishlist: "Sem pecas publicas na wishlist.",
        noPublicSales: "Sem pecas publicas na venda.",
        iHave: "Eu tenho",
        minifigPending: "Minifiguras em preparacao.",
        userSettings: "Configuracoes do usuario",
        name: "Nome",
        mail: "Email",
        changePassword: "Trocar senha",
        hidePasswordChange: "Ocultar troca de senha",
        newPassword: "Nova senha",
        repeatPassword: "Repetir senha",
        lug: "LUG",
        socialNetwork: "Rede social",
        none: "Nenhuma",
        userPlaceholder: "usuario",
        doubleClickSelect: "Duplo clique para selecionar",
        save: "Salvar",
        saving: "Salvando...",
        lugProperties: "Propriedades do LUG",
        lugInformation: "Informacoes do LUG",
        loadingLugInfo: "Carregando informacoes do LUG...",
        noLug: "Sem LUG",
        noName: "Sem nome",
        noCountry: "Sem pais",
        noDescription: "Sem descricao",
        lugsList: "Lista de LUGs",
        mustJoinOrCreateLug: "Voce precisa entrar ou criar um LUG para continuar.",
        doubleClickLugInfo: "Duplo clique em um LUG para ver informacoes.",
        loadingLugs: "Carregando LUGs...",
        noLugsLoaded: "Sem LUGs cadastrados.",
        yourLug: "Seu LUG",
        noOtherLugs: "Nao ha outros LUGs para mostrar.",
        membersSuffix: "membros",
        enterDirect: "Entrar direto",
        cancelRequest: "Cancelar solicitacao",
        requestJoin: "Solicitar ingresso",
        createNewLug: "Criar novo LUG",
        requestJoinTitle: "Solicitar ingresso",
        writeMessage: "Escreva uma mensagem",
        send: "Enviar",
        sending: "Enviando...",
        lugInfoTitle: "Informacoes do LUG",
        loadingInfo: "Carregando informacoes...",
        noMembersLoaded: "Sem membros carregados.",
        noSocial: "Sem rede social",
        noLugDetail: "Nao foi possivel carregar os detalhes do LUG.",
        joinRequestsTitle: "Solicitacoes de ingresso",
        loadingJoinRequests: "Carregando solicitacoes...",
        noPendingRequests: "Sem solicitacoes pendentes.",
        emptyLugsTitle: "LUGs vazios",
        loadingEmptyLugs: "Carregando LUGs vazios...",
        noPendingEmptyLugs: "Sem LUGs vazios pendentes.",
        deleteLug: "Apagar LUG",
        leaveOpen: "Deixar aberto",
        addItem: "Adicionar item",
        categories: "Categorias",
        noImage: "Sem imagem",
        searchPlaceholder: "Buscar peca por nome, codigo ou #codigo",
        searching: "Buscando...",
        noResults: "Sem resultados.",
        loadingList: "Carregando lista...",
        loadingParts: "Carregando pecas...",
        noCategoriesToShow: "Sem categorias para mostrar. Primeiro sincronize o catalogo.",
        wishlistListType: "Wishlist",
        saleListType: "Lista de venda",
        listNamePlaceholder: "Nome da lista",
        renameList: "Renomear lista",
        yes: "Sim",
        no: "Nao",
        deleteListConfirm: "Tem certeza que deseja apagar a lista? As informacoes de todas as pecas dentro dela serao perdidas.",
        price: "Preco",
        itemsOfList: "Itens da lista",
        listHasNoPartsYet: "Esta lista ainda nao tem pecas.",
        someoneOffersThisPart: "Alguem te oferece esta peca",
        catalog: "Catalogo",
        noPartsToShow: "Sem pecas para mostrar.",
        sortCode: "Codigo",
        sortColor: "Cor",
        sortUser: "Usuario",
        sortPriceAsc: "$ menor para maior",
        sortPriceDesc: "$ maior para menor",
        masterPanel: "Painel Master",
        createLug: "Criar LUG",
        doubleClickAssignLug: "Duplo clique em um LUG para definir como atual.",
        loadingPhrasesTitle: "Frases de carregamento",
        loadingPhrasesHelp: "Edite e salve as frases. Serão aplicadas nas proximas cargas.",
        maintenanceLockTitle: "Bloqueio de manutencao",
        enableMaintenance: "Colocar em manutencao",
        maintenanceLine1: "Frase linha 1",
        maintenanceLine2: "Frase linha 2",
        maintenanceLine1Placeholder: "Escreva a primeira linha",
        maintenanceLine2Placeholder: "Escreva a segunda linha",
        preview: "Pre-visualizacao",
        switchLug: "Mudar de LUG",
        uploadLogoMax: "Carregar imagem do logo (max 500x500)",
        countryCity: "Pais / cidade",
        description: "Descricao",
        creating: "Criando...",
        createNewLugShort: "Criar novo LUG",
        createLugButton: "Criar LUG",
        leaveCurrentLugOnCreate: "Se continuar, voce vai sair do seu LUG atual.",
        leaveCurrentLugOnAccess: "Se continuar, voce vai sair do seu LUG atual.",
        ok: "OK",
        loadingListById: "Carregando lista...",
        noMail: "Sem email",
        noColor: "Sem cor",
        noNameFallback: "Sem nome",
        noImageCache: "Imagem sem cache",
        notLegoColor: "(Cor nao LEGO)",
        backToCategories: "Voltar para categorias",
        notPrinted: "Nao impressas",
        printed: "Impressas",
        filterAll: "Todos",
        filterPopular: "Popular",
        filterOthers: "Outros",
        maintenanceSection: "Manutencao",
        disableMaintenance: "Sair da manutencao",
        noMessage: "Sem mensagem",
        reject: "Rejeitar",
        accept: "Aceitar",
        offerLine: (name: string, qty: number) => `${name} te oferece ${qty} pecas`,
        existingColorPart: "peca em cor existente",
        logo: "Logo",
        color1: "Cor1",
        color2: "Cor2",
        color3: "Cor3",
        exportUser: "Usuario",
        exportMail: "Email",
        exportDate: "Data",
        exportPiece: "Peca",
        exportQuantity: "Quantidade",
        exportImage: "Imagem",
        exportName: "Nome",
        exportColor: "Cor",
        buttonLists: "LISTAS",
        buttonMinifig: "minifiguras",
        buttonLugs: "LUGs",
        detailSale: "Detalhe de venda",
        detailWishlist: "Detalhe de wishlist",
        quantityWord: "Quantidade",
        publishedByWord: "Publicado por",
        selectColor: "Selecionar cor",
        exportPdf: "Exportar a PDF",
        listLotsCount: "Quantidade de lotes",
        listPiecesCount: "Quantidade de pecas",
        footerLegendLabel: "Legenda final",
        footerLegendPlaceholder: "Escreva o texto final",
        footerLegendSave: "Salvar legenda",
        minifigSectionTitle: "Minifiguras",
        collectibleSeriesTitle: "Series colecionaveis",
        loadingSeries: "Carregando series...",
        noSeriesFound: "Sem series colecionaveis.",
        selectSeriesHint: "Selecione uma serie para continuar.",
        syncMinifigSeries: "Sincronizar series de minifiguras",
        loadingSeriesItems: "Carregando minifiguras...",
        noSeriesItems: "Sem minifiguras nessa serie.",
        loadingFigureParts: "Carregando pecas...",
        noFigureParts: "Sem pecas para esta minifigura.",
        ownedComplete: "Completas",
        ownedMissing: "Com faltantes",
        ownedTotal: "Tenho",
        ownedFavorites: "Favoritas",
      };
    }

    return {
      back: "Volver",
      lists: "Listas",
      createList: "Crear lista",
      yourWishlists: "Tus Wishlists",
      yourSaleLists: "Tus listas de venta",
      noWishlistLists: "Sin listas de deseos.",
      noSaleLists: "Sin listas de venta.",
      renameListTitle: "Renombrar lista",
      private: "Privado",
      public: "Publico",
      deleteList: "Chau lista",
      offeredToOthers: "Piezas ofrecidas a otros",
      offeredToMe: "Piezas que me ofrecieron",
      print: "Print",
      close: "Cerrar",
      cancel: "Cancelar",
      loading: "Cargando...",
      noOffersRegistered: "Sin ofertas registradas.",
      noOffersReceived: "Sin ofertas recibidas.",
      members: "Integrantes",
      makeAdmin: "Hacer Admin",
      loadingMembers: "Cargando integrantes...",
      noMembers: "No hay integrantes para mostrar.",
      poolWishlist: "Pool de Wishlist",
      poolSales: "Pool de Ventas",
      noPublicWishlist: "Sin piezas publicas en wishlist.",
      noPublicSales: "Sin piezas publicas en venta.",
      iHave: "Yo tengo",
      minifigPending: "Minifiguras en preparacion.",
      userSettings: "Configuracion de usuario",
      name: "Nombre",
      mail: "Mail",
      changePassword: "Cambiar contrasena",
      hidePasswordChange: "Ocultar cambio de contrasena",
      newPassword: "Nueva contrasena",
      repeatPassword: "Repetir contrasena",
      lug: "LUG",
      socialNetwork: "Red social",
      none: "Ninguna",
      userPlaceholder: "usuario",
      doubleClickSelect: "Doble clic para seleccionar",
      save: "Guardar",
      saving: "Guardando...",
      lugProperties: "Propiedades del LUG",
      lugInformation: "Informacion del LUG",
      loadingLugInfo: "Cargando informacion del LUG...",
      noLug: "Sin LUG",
      noName: "Sin nombre",
      noCountry: "Sin pais",
      noDescription: "Sin descripcion",
      lugsList: "Lista de LUGs",
      mustJoinOrCreateLug: "Tenes que unirte o crear un LUG para continuar.",
      doubleClickLugInfo: "Doble clic en un LUG para ver su informacion.",
      loadingLugs: "Cargando LUGs...",
      noLugsLoaded: "No hay LUGs cargados.",
      yourLug: "Tu LUG",
      noOtherLugs: "No hay otros LUGs para mostrar.",
      membersSuffix: "miembros",
      enterDirect: "Entrar directo",
      cancelRequest: "Cancelar solicitud",
      requestJoin: "Solicitar ingreso",
      createNewLug: "Crear nuevo LUG",
      requestJoinTitle: "Solicitar ingreso",
      writeMessage: "Escribe un mensaje",
      send: "Enviar",
      sending: "Enviando...",
      lugInfoTitle: "Informacion del LUG",
      loadingInfo: "Cargando informacion...",
      noMembersLoaded: "No hay miembros cargados.",
      noSocial: "Sin red social",
      noLugDetail: "No pudimos cargar el detalle del LUG.",
      joinRequestsTitle: "Solicitudes de ingreso",
      loadingJoinRequests: "Cargando solicitudes...",
      noPendingRequests: "No hay solicitudes pendientes.",
      emptyLugsTitle: "LUGs vacios",
      loadingEmptyLugs: "Cargando LUGs vacios...",
      noPendingEmptyLugs: "No hay LUGs vacios pendientes.",
      deleteLug: "Borrar LUG",
      leaveOpen: "Dejar abierto",
      addItem: "Agregar item",
      categories: "Categorias",
      noImage: "Sin img",
      searchPlaceholder: "Buscar pieza por nombre, codigo o #codigo",
      searching: "Buscando...",
      noResults: "Sin resultados.",
      loadingList: "Cargando lista...",
      loadingParts: "Cargando piezas...",
      noCategoriesToShow: "No hay categorias para mostrar. Primero hay que sincronizar el catalogo.",
      wishlistListType: "Lista de deseos",
      saleListType: "Lista de venta",
      listNamePlaceholder: "Nombre de la lista",
      renameList: "Renombrar lista",
      yes: "Si",
      no: "No",
      deleteListConfirm: "¿Estas seguro que queres borrar la lista? Se perdera la informacion de todas las piezas que esten dentro.",
      price: "Precio",
      itemsOfList: "Items de la lista",
      listHasNoPartsYet: "Esta lista todavia no tiene piezas.",
      someoneOffersThisPart: "Alguien te ofrece esta pieza",
      catalog: "Catalogo",
      noPartsToShow: "Sin piezas para mostrar.",
      sortCode: "Codigo",
      sortColor: "Color",
      sortUser: "Usuario",
      sortPriceAsc: "$ menor a mayor",
      sortPriceDesc: "$ mayor a menor",
      masterPanel: "Panel Master",
      createLug: "Crear LUG",
      doubleClickAssignLug: "Doble clic en un LUG para asignarlo como actual.",
      loadingPhrasesTitle: "Frases de carga",
      loadingPhrasesHelp: "Edita y guarda las frases. Se aplica en proximas cargas.",
      maintenanceLockTitle: "Bloqueo de mantenimiento",
      enableMaintenance: "Poner en mantenimiento",
      maintenanceLine1: "Frase linea 1",
      maintenanceLine2: "Frase linea 2",
      maintenanceLine1Placeholder: "Escribi la primera linea",
      maintenanceLine2Placeholder: "Escribi la segunda linea",
      preview: "Vista previa",
      switchLug: "Cambiar de LUG",
      uploadLogoMax: "Cargar imagen logo (max 500x500)",
      countryCity: "Pais / ciudad",
      description: "Descripcion",
      creating: "Creando...",
      createNewLugShort: "Crear nuevo LUG",
      createLugButton: "Crear LUG",
      leaveCurrentLugOnCreate: "Si seguis adelante vas a abandonar tu LUG actual.",
      leaveCurrentLugOnAccess: "Si seguis adelante vas a salir de tu LUG actual.",
      ok: "OK",
      loadingListById: "Cargando lista...",
      noMail: "Sin mail",
      noColor: "Sin color",
      noNameFallback: "Sin nombre",
      noImageCache: "Imagen sin cache",
      notLegoColor: "(Color no LEGO)",
      backToCategories: "Volver a categorias",
      notPrinted: "No impresas",
      printed: "Impresas",
      filterAll: "All",
      filterPopular: "Popular",
      filterOthers: "Otros",
      maintenanceSection: "Mantenimiento",
      disableMaintenance: "Sacar de mantenimiento",
      noMessage: "Sin mensaje",
      reject: "Rechazar",
      accept: "Aceptar",
      offerLine: (name: string, qty: number) => `${name} te ofrece ${qty} piezas`,
      existingColorPart: "pieza en color existente",
      logo: "Logo",
      color1: "Color1",
      color2: "Color2",
      color3: "Color3",
      exportUser: "Usuario",
      exportMail: "Mail",
      exportDate: "Fecha",
      exportPiece: "Pieza",
      exportQuantity: "Cantidad",
      exportImage: "Imagen",
      exportName: "Nombre",
      exportColor: "Color",
      buttonLists: "LISTAS",
      buttonMinifig: "minifiguras",
      buttonLugs: "LUGs",
      detailSale: "Detalle de Venta",
      detailWishlist: "Detalle de Wishlist",
      quantityWord: "Cantidad",
      publishedByWord: "Publicado por",
      selectColor: "Seleccionar color",
      exportPdf: "Exportar a PDF",
      listLotsCount: "Cantidad de lotes",
      listPiecesCount: "Cantidad de piezas",
      footerLegendLabel: "Leyenda final",
      footerLegendPlaceholder: "Escribi el texto final",
      footerLegendSave: "Guardar leyenda",
      minifigSectionTitle: "Minifiguras",
      collectibleSeriesTitle: "Series coleccionables",
      loadingSeries: "Cargando series...",
      noSeriesFound: "No hay series coleccionables.",
      selectSeriesHint: "Selecciona una serie para continuar.",
      syncMinifigSeries: "Sincronizar series de minifiguras",
      loadingSeriesItems: "Cargando minifiguras...",
      noSeriesItems: "No hay minifiguras en esta serie.",
      loadingFigureParts: "Cargando piezas...",
      noFigureParts: "No hay piezas para esta minifigura.",
      ownedComplete: "Completas",
      ownedMissing: "Con faltantes",
      ownedTotal: "Tengo",
      ownedFavorites: "Favoritas",
    };
  }, [language]);

  const submitText = mode === "register" ? t.createAccount : t.signIn;
  const authCooldownRemaining = Math.max(0, Math.ceil((authCooldownUntil - authNowMs) / 1000));
  const buildListStatsLabel = useCallback(
    (lotes: number, piezas: number) => {
      if (language === "en") {
        return `Lots: ${lotes} - Pieces: ${piezas}`;
      }
      if (language === "pt") {
        return `Lotes: ${lotes} - Pecas: ${piezas}`;
      }
      return `Lotes: ${lotes} - Piezas: ${piezas}`;
    },
    [language],
  );
  const statusText = useMemo(() => {
    if (language === "en") {
      return {
        loadingPhrasesSaved: "Loading phrases saved.",
        maintenanceEnabled: "Maintenance enabled.",
        maintenanceDisabled: "Maintenance disabled.",
        listNameRequired: "List name is required.",
        noDataToExport: "No data to export.",
        printWindowFailed: "Could not open export window for PDF.",
        listOpenFailed: "Could not open that list.",
        missingPriceMigration: "Missing DB migration for price (0029_add_value_to_list_items.sql).",
        selectPartFirst: "Select a part first.",
        validSalePrice: "Enter a valid price for sale list.",
        noListSelectedForExport: "No list selected for export.",
        noPartsToExport: "No parts to export.",
        cannotOfferOwnWishlist: "You cannot offer on your own wishlist.",
        offerSent: "Offer sent.",
        itemDeleted: "Item deleted.",
        validPrice: "Enter a valid price.",
        dbMissingPriceColumn: "Database still has no price column. Apply the price migration.",
        priceUpdated: "Price updated.",
        passwordMinLength: "New password must be at least 6 characters.",
        passwordsMismatch: "Passwords do not match.",
        settingsSaved: "Settings saved.",
        lugNameRequired: "LUG name is required.",
        lugAssigned: "LUG assigned to user.",
        userHasNoLug: "This user has no assigned LUG.",
        onlyAdminCanEditLug: "Only a LUG admin can edit this information.",
        lugInfoUpdated: "LUG information updated.",
        lugMemberCountFailed: "Could not calculate member count per LUG.",
        footerLegendSaved: "Footer legend saved.",
        footerLegendMigrationMissing: "Missing DB migration for footer legend (0031_add_footer_legend_to_app_maintenance.sql).",
        minifigSeriesSynced: "Minifigure series synced.",
      };
    }

    if (language === "pt") {
      return {
        loadingPhrasesSaved: "Frases de carregamento salvas.",
        maintenanceEnabled: "Manutencao ativada.",
        maintenanceDisabled: "Manutencao desativada.",
        listNameRequired: "O nome da lista e obrigatorio.",
        noDataToExport: "Sem dados para exportar.",
        printWindowFailed: "Nao foi possivel abrir a janela para exportar PDF.",
        listOpenFailed: "Nao foi possivel abrir essa lista.",
        missingPriceMigration: "Falta migracao de DB para preco (0029_add_value_to_list_items.sql).",
        selectPartFirst: "Selecione uma peca primeiro.",
        validSalePrice: "Informe um preco valido para a lista de venda.",
        noListSelectedForExport: "Nenhuma lista selecionada para exportar.",
        noPartsToExport: "Sem pecas para exportar.",
        cannotOfferOwnWishlist: "Voce nao pode oferecer na sua propria wishlist.",
        offerSent: "Oferta enviada.",
        itemDeleted: "Item removido.",
        validPrice: "Informe um preco valido.",
        dbMissingPriceColumn: "A base ainda nao tem coluna de preco. Aplique a migracao de precos.",
        priceUpdated: "Preco atualizado.",
        passwordMinLength: "A nova senha deve ter pelo menos 6 caracteres.",
        passwordsMismatch: "As senhas nao coincidem.",
        settingsSaved: "Configuracoes salvas.",
        lugNameRequired: "O nome do LUG e obrigatorio.",
        lugAssigned: "LUG atribuido ao usuario.",
        userHasNoLug: "Este usuario nao tem LUG atribuido.",
        onlyAdminCanEditLug: "Somente um admin do LUG pode editar estas informacoes.",
        lugInfoUpdated: "Informacoes do LUG atualizadas.",
        lugMemberCountFailed: "Nao foi possivel calcular a quantidade de membros por LUG.",
        footerLegendSaved: "Legenda final salva.",
        footerLegendMigrationMissing: "Falta migracao de DB para legenda final (0031_add_footer_legend_to_app_maintenance.sql).",
        minifigSeriesSynced: "Series de minifiguras sincronizadas.",
      };
    }

    return {
      loadingPhrasesSaved: "Frases de carga guardadas.",
      maintenanceEnabled: "Mantenimiento activado.",
      maintenanceDisabled: "Mantenimiento desactivado.",
      listNameRequired: "El nombre de la lista es obligatorio.",
      noDataToExport: "No hay datos para exportar.",
      printWindowFailed: "No se pudo abrir la ventana para exportar PDF.",
      listOpenFailed: "No pudimos abrir esa lista.",
      missingPriceMigration: "Falta migracion de DB para precio (0029_add_value_to_list_items.sql).",
      selectPartFirst: "Selecciona una pieza primero.",
      validSalePrice: "Ingresa un precio valido para la lista de venta.",
      noListSelectedForExport: "No hay lista seleccionada para exportar.",
      noPartsToExport: "No hay piezas para exportar.",
      cannotOfferOwnWishlist: "No podes ofrecer en tu propia wishlist.",
      offerSent: "Oferta enviada.",
      itemDeleted: "Item eliminado.",
      validPrice: "Ingresa un precio valido.",
      dbMissingPriceColumn: "La base todavia no tiene columna de precio. Aplica la migracion de precios.",
      priceUpdated: "Precio actualizado.",
      passwordMinLength: "La nueva contrasena debe tener al menos 6 caracteres.",
      passwordsMismatch: "Las contrasenas no coinciden.",
      settingsSaved: "Configuracion guardada.",
      lugNameRequired: "El nombre del LUG es obligatorio.",
      lugAssigned: "LUG asignado al usuario.",
      userHasNoLug: "Este usuario no tiene LUG asignado.",
      onlyAdminCanEditLug: "Solo un admin del LUG puede editar esta informacion.",
      lugInfoUpdated: "Informacion del LUG actualizada.",
      lugMemberCountFailed: "No pudimos calcular la cantidad de miembros por LUG.",
      footerLegendSaved: "Leyenda final guardada.",
      footerLegendMigrationMissing: "Falta migracion de DB para leyenda final (0031_add_footer_legend_to_app_maintenance.sql).",
      minifigSeriesSynced: "Series de minifiguras sincronizadas.",
    };
  }, [language]);
  const currentUserLug = useMemo(
    () => masterLugs.find((lug) => lug.lug_id === currentLugId) ?? null,
    [masterLugs, currentLugId],
  );
  const activeLanguageIconSrc = useMemo(() => {
    if (language === "en") return "/Idioma_EN.svg";
    if (language === "pt") return "/Idioma_PT.svg";
    return "/Idioma_ES.svg";
  }, [language]);
  const mustSelectLugOnDashboard = Boolean(userId && activeSection === "dashboard" && !currentLugId);
  const otherLugs = useMemo(
    () => masterLugs.filter((lug) => lug.lug_id !== currentLugId),
    [masterLugs, currentLugId],
  );
  const listasDeseos = useMemo(() => listasItems.filter((item) => item.tipo === "deseos"), [listasItems]);
  const listasVenta = useMemo(() => listasItems.filter((item) => item.tipo === "venta"), [listasItems]);
  const totalListasCreated = useMemo(
    () => Math.max(dashboardListsCreatedCount, listasDeseos.length + listasVenta.length),
    [dashboardListsCreatedCount, listasDeseos.length, listasVenta.length],
  );
  const showDashboardBalanceRow = isMaster || dashboardSectionBalanceEnabled;
  const showDashboardListasRow = isMaster || dashboardSectionListasEnabled;
  const showDashboardSetsRow = isMaster || dashboardSectionSetsEnabled;
  const showDashboardMinifigRow = isMaster || dashboardSectionMinifigEnabled;
  const filteredCategories = useMemo(() => {
    const getGroup = (name: string): CategoryQuickFilter => {
      const normalized = name.toLowerCase();
      if (normalized.includes("minifig") || normalized.includes("minidoll")) {
        return "minifig";
      }
      if (normalized.includes("technic")) {
        return "technic";
      }
      if (
        normalized.includes("brick") ||
        normalized.includes("plate") ||
        normalized.includes("tile") ||
        normalized.includes("slope") ||
        normalized.includes("modified") ||
        normalized.includes("wedge") ||
        normalized.includes("arch") ||
        normalized.includes("panel") ||
        normalized.includes("round")
      ) {
        return "popular";
      }
      return "otros";
    };

    if (categoryQuickFilter === "all") {
      return partsCategories;
    }

    return partsCategories.filter((category) => getGroup(category.name) === categoryQuickFilter);
  }, [partsCategories, categoryQuickFilter]);
  const uiColor1 = currentLugColor1 || "#006eb2";
  const uiColor3 = currentLugColor3 || "#111111";
  const uiColor1Text = getContrastTextColor(uiColor1);
  const currentLugDisplayName = miLugHeaderName || lugInfoData?.nombre || currentUserLug?.nombre || "Mi LUG";
  const miLugPoolPageSize = 30;
  const miLugMembersPageSize = 16;

  const fetchProfileNamesByIds = useCallback(async (ids: string[]) => {
    const cleanIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
    if (cleanIds.length === 0) {
      return new Map<string, string>();
    }

    try {
      let authHeaders: Record<string, string> | undefined;
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (accessToken) {
          authHeaders = { Authorization: `Bearer ${accessToken}` };
        }
      }

      const response = await fetch("/api/profiles/names", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
        body: JSON.stringify({ ids: cleanIds }),
      });
      const json = (await response.json()) as { names?: Record<string, string> };
      const names = json.names ?? {};
      return new Map(Object.entries(names).map(([id, fullName]) => [String(id), String(fullName).trim()]));
    } catch {
      return new Map<string, string>();
    }
  }, [supabase]);

  const fetchProfileAvatarsByIds = useCallback(async (ids: string[]) => {
    const cleanIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
    if (cleanIds.length === 0) {
      return new Map<string, string>();
    }

    try {
      let authHeaders: Record<string, string> | undefined;
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (accessToken) {
          authHeaders = { Authorization: `Bearer ${accessToken}` };
        }
      }

      const response = await fetch("/api/profiles/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
        body: JSON.stringify({ ids: cleanIds }),
      });
      const json = (await response.json()) as { avatars?: Record<string, string> };
      const avatars = json.avatars ?? {};
      return new Map(Object.entries(avatars).map(([id, avatarKey]) => [String(id), String(avatarKey).trim()]));
    } catch {
      return new Map<string, string>();
    }
  }, [supabase]);

  const fetchCurrentLugMemberNamesByIds = useCallback(async (ids: string[]) => {
    const cleanIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
    if (!supabase || !currentLugId || cleanIds.length === 0) {
      return new Map<string, string>();
    }

    const { data, error } = await supabase.rpc("get_lug_members_current", {
      target_lug_id: currentLugId,
    });

    if (error) {
      return new Map<string, string>();
    }

    const targetSet = new Set(cleanIds);
    const map = new Map<string, string>();
    ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
      const id = String(row.id ?? "").trim();
      const fullName = String(row.full_name ?? "").trim();
      if (id && fullName && targetSet.has(id)) {
        map.set(id, fullName);
      }
    });

    return map;
  }, [currentLugId, supabase]);
  const panelFilteredParts = useMemo(() => {
    const looksPrinted = (part: PartCatalogItem) => {
      if (typeof part.is_printed === "boolean") {
        return part.is_printed;
      }
      const code = part.part_num.toLowerCase();
      const title = part.name.toLowerCase();
      return /pb|pr|pat/.test(code) || title.includes("pattern") || title.includes("printed");
    };

    return panelPartsResults.filter((part) => {
      const isPrintedPart = looksPrinted(part);
      if (isPrintedPart && panelPrintFilters.printed) {
        return true;
      }
      if (!isPrintedPart && panelPrintFilters.no_printed) {
        return true;
      }
      return false;
    });
  }, [panelPartsResults, panelPrintFilters]);
  const panelPartsMaxPage = useMemo(() => Math.max(1, Math.ceil(panelFilteredParts.length / 20)), [panelFilteredParts.length]);
  const panelCurrentPage = useMemo(() => Math.min(panelPartsPage, panelPartsMaxPage), [panelPartsPage, panelPartsMaxPage]);
  const panelVisibleParts = useMemo(() => {
    const from = Math.max(0, (panelCurrentPage - 1) * 20);
    return panelFilteredParts.slice(from, from + 20);
  }, [panelFilteredParts, panelCurrentPage]);
  const selectedSearchPart = useMemo(
    () => partsSearchResults.find((part) => part.part_num === selectedSearchPartNum) ?? null,
    [partsSearchResults, selectedSearchPartNum],
  );
  const listItemsPageSize = 20;
  const listItemsMaxPage = useMemo(() => Math.max(1, Math.ceil(listItemsRows.length / listItemsPageSize)), [listItemsRows.length]);
  const listItemsCurrentPage = useMemo(() => Math.min(listItemsPage, listItemsMaxPage), [listItemsMaxPage, listItemsPage]);
  const listItemsVisibleRows = useMemo(() => {
    const from = Math.max(0, (listItemsCurrentPage - 1) * listItemsPageSize);
    return listItemsRows.slice(from, from + listItemsPageSize);
  }, [listItemsCurrentPage, listItemsRows]);
  const colorOptions = useMemo(() => {
    return goBrickColors
      .map((color) => {
        const label = addItemColorMode === "lego" ? color.lego : color.bricklink;
        return {
          id: color.id,
          label,
          hex: color.hex,
          lego_available: color.lego_available,
        };
      })
      .filter(
        (value): value is { id: number; label: string; hex: string | null; lego_available: boolean } => Boolean(value.label),
      );
  }, [goBrickColors, addItemColorMode]);
  const visibleColorOptions = useMemo(() => {
    if (!addItemColorExists) {
      return colorOptions;
    }

    if (partAvailableColorNames.length === 0) {
      return colorOptions;
    }

    return colorOptions.filter((option) => colorMatchesAvailable(option.label, partAvailableColorNames));
  }, [addItemColorExists, colorOptions, partAvailableColorNames]);
  const selectedColorHex = useMemo(
    () => visibleColorOptions.find((option) => option.label === addItemColorNameInput)?.hex ?? null,
    [visibleColorOptions, addItemColorNameInput],
  );
  const addItemColorDisplayLabel = useMemo(() => {
    if (!addItemColorNameInput) {
      return labels.selectColor;
    }
    if (addItemColorNameInput === NO_COLOR_LABEL) {
      return labels.noColor;
    }
    return addItemColorNameInput;
  }, [addItemColorNameInput, labels.noColor, labels.selectColor]);
  const colorHexByLabel = useMemo(() => {
    const map = new Map<string, string>();
    goBrickColors.forEach((color) => {
      if (!color.hex) {
        return;
      }
      if (color.lego) {
        map.set(normalizeColorLabel(color.lego), color.hex);
      }
      if (color.bricklink) {
        map.set(normalizeColorLabel(color.bricklink), color.hex);
      }
    });
    return map;
  }, [goBrickColors]);
  const miLugWishlistSortedItems = useMemo(() => {
    const rows = (hideOwnPoolItems && userId
      ? miLugPoolWishlistItems.filter((item) => item.publisher_id !== userId)
      : miLugPoolWishlistItems
    ).slice();
    rows.sort((a, b) => {
      if (miLugWishlistSort === "color") {
        return String(a.color_label ?? "").localeCompare(String(b.color_label ?? ""));
      }
      if (miLugWishlistSort === "usuario") {
        return a.publisher_name.localeCompare(b.publisher_name);
      }
      return a.part_num.localeCompare(b.part_num);
    });
    return rows;
  }, [hideOwnPoolItems, miLugPoolWishlistItems, miLugWishlistSort, userId]);
  const miLugSaleSortedItems = useMemo(() => {
    const rows = (hideOwnPoolItems && userId
      ? miLugPoolSaleItems.filter((item) => item.publisher_id !== userId)
      : miLugPoolSaleItems
    ).slice();
    rows.sort((a, b) => {
      if (miLugSaleSort === "color") {
        return String(a.color_label ?? "").localeCompare(String(b.color_label ?? ""));
      }
      if (miLugSaleSort === "usuario") {
        return a.publisher_name.localeCompare(b.publisher_name);
      }
      if (miLugSaleSort === "price_asc") {
        return (a.value ?? Number.POSITIVE_INFINITY) - (b.value ?? Number.POSITIVE_INFINITY);
      }
      if (miLugSaleSort === "price_desc") {
        return (b.value ?? Number.NEGATIVE_INFINITY) - (a.value ?? Number.NEGATIVE_INFINITY);
      }
      return a.part_num.localeCompare(b.part_num);
    });
    return rows;
  }, [hideOwnPoolItems, miLugPoolSaleItems, miLugSaleSort, userId]);
  const miLugWishlistMaxPage = useMemo(
    () => Math.max(1, Math.ceil(miLugWishlistSortedItems.length / miLugPoolPageSize)),
    [miLugWishlistSortedItems.length],
  );
  const miLugSaleMaxPage = useMemo(() => Math.max(1, Math.ceil(miLugSaleSortedItems.length / miLugPoolPageSize)), [miLugSaleSortedItems.length]);
  const miLugWishlistCurrentPage = useMemo(() => Math.min(miLugWishlistPage, miLugWishlistMaxPage), [miLugWishlistMaxPage, miLugWishlistPage]);
  const miLugSaleCurrentPage = useMemo(() => Math.min(miLugSalePage, miLugSaleMaxPage), [miLugSaleMaxPage, miLugSalePage]);
  const miLugWishlistVisibleItems = useMemo(() => {
    const from = Math.max(0, (miLugWishlistCurrentPage - 1) * miLugPoolPageSize);
    return miLugWishlistSortedItems.slice(from, from + miLugPoolPageSize);
  }, [miLugWishlistCurrentPage, miLugWishlistSortedItems]);
  const miLugSaleVisibleItems = useMemo(() => {
    const from = Math.max(0, (miLugSaleCurrentPage - 1) * miLugPoolPageSize);
    return miLugSaleSortedItems.slice(from, from + miLugPoolPageSize);
  }, [miLugSaleCurrentPage, miLugSaleSortedItems]);
  const miLugMembersMaxPage = useMemo(
    () => Math.max(1, Math.ceil(miLugMembersRows.length / miLugMembersPageSize)),
    [miLugMembersRows.length],
  );
  const miLugMembersCurrentPage = useMemo(() => Math.min(miLugMembersPage, miLugMembersMaxPage), [miLugMembersMaxPage, miLugMembersPage]);
  const miLugMembersVisibleRows = useMemo(() => {
    const from = Math.max(0, (miLugMembersCurrentPage - 1) * miLugMembersPageSize);
    return miLugMembersRows.slice(from, from + miLugMembersPageSize);
  }, [miLugMembersCurrentPage, miLugMembersRows]);
  const useColoredPreview = Boolean(
    selectedSearchPart?.part_num && addItemColorNameInput.trim() && addItemColorNameInput !== NO_COLOR_LABEL,
  );
  const selectedPartPreviewImage = useColoredPreview
    ? selectedPartColorImageUrl || selectedSearchPart?.part_img_url || null
    : selectedSearchPart?.part_img_url || null;
  const showGenericColorImageWarning = useColoredPreview && selectedPartColorImageMissing;
  const showLoaderPopup =
    loading ||
    settingsSaving ||
    creatingLug ||
    settingsLugPanelLoading ||
    settingsLugSaving ||
    lugInfoLoading ||
    masterLugsLoading ||
    requestActionLoadingLugId !== null ||
    joinRequestSending ||
    adminRequestsLoading ||
    adminDecisionLoading ||
    promoteMemberLoadingId !== null ||
    masterEmptyLugsLoading ||
    masterLugActionLoadingId !== null ||
    legacyLogosBackfillRunning ||
    listasLoading ||
    listasSaving ||
    listItemsLoading ||
    panelPartsLoading ||
    miLugPoolsLoading;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onPopState = () => {
      const section = getSectionFromPath(window.location.pathname);
      if (section) {
        setActiveSection(section);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!showColorDropdown && !showPartSearchDropdown) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      if (showColorDropdown && colorDropdownRef.current && !colorDropdownRef.current.contains(event.target as Node)) {
        setShowColorDropdown(false);
      }
      if (showPartSearchDropdown && partSearchDropdownRef.current && !partSearchDropdownRef.current.contains(event.target as Node)) {
        setShowPartSearchDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showColorDropdown, showPartSearchDropdown]);

  useEffect(() => {
    if (!addItemColorExists) {
      return;
    }

    const partNum = selectedSearchPart?.part_num;
    if (!partNum) {
      return;
    }
    const safePartNum = partNum;

    let cancelled = false;

    async function loadAvailableColors() {
      try {
        const params = new URLSearchParams({ part_num: safePartNum, mode: addItemColorMode });
        const response = await fetch(`/api/rebrickable/part-colors?${params.toString()}`);
        const json = (await response.json()) as { colors?: string[] };

        if (cancelled) {
          return;
        }

        const names = Array.isArray(json.colors) ? json.colors.map((name) => String(name)) : [];
        setPartAvailableColorNames(names);

        if (addItemColorNameInput !== NO_COLOR_LABEL && !colorMatchesAvailable(addItemColorNameInput, names)) {
          setAddItemColorNameInput(NO_COLOR_LABEL);
        }
      } catch {
        if (!cancelled) {
          setPartAvailableColorNames([]);
        }
      }
    }

    void loadAvailableColors();

    return () => {
      cancelled = true;
    };
  }, [addItemColorExists, selectedSearchPart?.part_num, addItemColorMode, addItemColorNameInput]);

  const getSupabaseAuthHeaders = useCallback(async () => {
    if (!supabase) {
      return undefined;
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return undefined;
    }

    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }, [supabase]);

  useEffect(() => {
    const raw = partsSearchQuery.trim();
    const normalized = raw.startsWith("#") ? raw.slice(1).trim() : raw;
    const normalizedForMatch = normalizeDimensionText(normalized);

    if (normalizedForMatch.length < 3) {
      setPartsSearchResults(selectedSearchPart ? [selectedSearchPart] : []);
      setPartsSearchLoading(false);
      setShowPartSearchDropdown(false);
      return;
    }

    if (selectedSearchPart && raw === formatPartLabel(selectedSearchPart)) {
      setPartsSearchResults([selectedSearchPart]);
      setPartsSearchLoading(false);
      setShowPartSearchDropdown(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setPartsSearchLoading(true);
      try {
        const authHeaders = await getSupabaseAuthHeaders();

        const strictParams = new URLSearchParams({ q: normalized, limit: "10" });
        const strictResponse = await fetch(`/api/parts/search?${strictParams.toString()}`, {
          headers: authHeaders,
        });
        const strictJson = (await strictResponse.json()) as { results?: PartCatalogItem[] };
        if (cancelled) {
          return;
        }

        const strictRows = Array.isArray(strictJson.results) ? strictJson.results : [];

        if (strictRows.length < 10) {
          const fallbackParams = new URLSearchParams({ q: normalized, limit: "10", strict: "0" });
          const fallbackResponse = await fetch(`/api/parts/search?${fallbackParams.toString()}`, {
            headers: authHeaders,
          });
          const fallbackJson = (await fallbackResponse.json()) as { results?: PartCatalogItem[] };
          if (cancelled) {
            return;
          }

          const fallbackRows = Array.isArray(fallbackJson.results) ? fallbackJson.results : [];
          const seen = new Set(strictRows.map((row) => row.part_num));
          const extraRows: PartCatalogItem[] = [];
          for (const row of fallbackRows) {
            if (seen.has(row.part_num)) {
              continue;
            }
            seen.add(row.part_num);
            extraRows.push(row);
            if (extraRows.length >= 10) {
              break;
            }
          }

          const mergedRows = [...strictRows, ...extraRows];
          setPartsSearchResults(mergedRows);
          setShowPartSearchDropdown(mergedRows.length > 0);
        } else {
          setPartsSearchResults(strictRows);
          setShowPartSearchDropdown(strictRows.length > 0);
        }
      } catch {
        if (!cancelled) {
          setPartsSearchResults([]);
          setShowPartSearchDropdown(false);
        }
      } finally {
        if (!cancelled) {
          setPartsSearchLoading(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [getSupabaseAuthHeaders, partsSearchQuery, selectedSearchPart]);

  useEffect(() => {
    const partNum = selectedSearchPart?.part_num;
    const colorLabel = addItemColorNameInput.trim();

    if (!partNum || !colorLabel || colorLabel === NO_COLOR_LABEL) {
      return;
    }

    const safePartNum = partNum;

    let cancelled = false;

    async function loadColoredImage() {
      try {
        const params = new URLSearchParams({
          part_num: safePartNum,
          color_name: colorLabel,
          mode: addItemColorMode,
        });

        const response = await fetch(`/api/rebrickable/part-color-image?${params.toString()}`);
        const json = (await response.json()) as { image_url?: string | null };

        if (cancelled) {
          return;
        }

        if (json.image_url) {
          setSelectedPartColorImageUrl(String(json.image_url));
          setSelectedPartColorImageMissing(false);
        } else {
          setSelectedPartColorImageUrl(null);
          setSelectedPartColorImageMissing(true);
        }
      } catch {
        if (!cancelled) {
          setSelectedPartColorImageUrl(null);
          setSelectedPartColorImageMissing(true);
        }
      }
    }

    void loadColoredImage();

    return () => {
      cancelled = true;
    };
  }, [selectedSearchPart?.part_num, addItemColorNameInput, addItemColorMode]);

  function getFaceImagePath(faceNum: number) {
    return `/api/avatar/Cabeza_${String(faceNum).padStart(2, "0")}.png`;
  }

  function parseAvatarFace(avatarKey: string | null | undefined) {
    const raw = String(avatarKey ?? "");
    const maybe = Number(raw.replace("Cabeza_", "").replace(".png", ""));
    return Number.isFinite(maybe) && maybe >= 1 && maybe <= FACE_TOTAL ? maybe : 1;
  }

  function parseAvatarFaceStrict(avatarKey: string | null | undefined) {
    const raw = String(avatarKey ?? "");
    const maybe = Number(raw.replace("Cabeza_", "").replace(".png", ""));
    return Number.isFinite(maybe) && maybe >= 1 && maybe <= FACE_TOTAL ? maybe : null;
  }

  function getAvatarFaceForMember(_memberId: string, avatarKey: string | null | undefined) {
    const explicit = parseAvatarFaceStrict(avatarKey);
    if (explicit) {
      return explicit;
    }

    return 1;
  }

  function toColorPickerValue(value: string, fallback: string) {
    const normalized = String(value ?? "").trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized) ? normalized : fallback;
  }

  function isTargetRedColor(value: unknown) {
    if (!Array.isArray(value) || value.length < 3) {
      return false;
    }

    const [r, g, b] = value;
    if (typeof r !== "number" || typeof g !== "number" || typeof b !== "number") {
      return false;
    }

    return r > 0.75 && g < 0.3 && b < 0.3;
  }

  const loaderAnimationData = useMemo(() => {
    const toUnitRgb = (hexColor: string) => {
      const normalized = toColorPickerValue(hexColor, "#006eb2");
      const hex =
        normalized.length === 4
          ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
          : normalized;

      const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
      const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
      const b = Number.parseInt(hex.slice(5, 7), 16) / 255;

      return [r, g, b, 1] as [number, number, number, number];
    };

    const clone = JSON.parse(JSON.stringify(legoSpinnerAnimation)) as Record<string, unknown>;
    const nextColor = toUnitRgb(uiColor1);

    const walk = (node: unknown) => {
      if (Array.isArray(node)) {
        node.forEach((item) => walk(item));
        return;
      }

      if (!node || typeof node !== "object") {
        return;
      }

      const record = node as Record<string, unknown>;
      if (record.c && typeof record.c === "object") {
        const colorRecord = record.c as Record<string, unknown>;
        if (isTargetRedColor(colorRecord.k)) {
          colorRecord.k = [...nextColor];
        }
      }

      Object.values(record).forEach((value) => walk(value));
    };

    walk(clone);
    return clone;
  }, [uiColor1]);

  function getContrastTextColor(backgroundColor: string | null | undefined) {
    const normalized = String(backgroundColor ?? "").trim();
    const isValidHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized);
    if (!isValidHex) {
      return "#111111";
    }

    const hex =
      normalized.length === 4
        ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
        : normalized;
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? "#111111" : "#ffffff";
  }

  const pickRandomLoadingPhrase = useCallback(() => {
    const source = loadingPhrases.map((item) => item.trim()).filter((item) => item.length > 0);
    if (source.length === 0) {
      setLoadingPhrase(DEFAULT_LOADING_PHRASES[0]);
      return;
    }

    const index = Math.floor(Math.random() * source.length);
    setLoadingPhrase(source[index]);
  }, [loadingPhrases]);

  const startBootLoading = useCallback((forcePick = false) => {
    setAppBootLoading((prev) => {
      if (forcePick || !prev) {
        pickRandomLoadingPhrase();
      }
      return true;
    });
  }, [pickRandomLoadingPhrase]);

  function saveLoadingPhrases(nextDraft: string[]) {
    const normalized = DEFAULT_LOADING_PHRASES.map((fallback, index) => nextDraft[index]?.trim() || fallback);
    setLoadingPhrases(normalized);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("loading_phrases_v1", JSON.stringify(normalized));
    }

    setStatus(statusText.loadingPhrasesSaved);
    setShowLoadingPhrasesPanel(false);
  }

  const loadMaintenanceSettings = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const maintenanceWithFooter = await supabase
      .from("app_maintenance")
      .select("enabled, message_line1, message_line2, footer_legend, show_balance, show_listas, show_sets, show_minifiguras")
      .eq("id", 1)
      .maybeSingle();

    const maintenanceResult = maintenanceWithFooter.error
      ? await supabase
          .from("app_maintenance")
          .select("enabled, message_line1, message_line2")
          .eq("id", 1)
          .maybeSingle()
      : maintenanceWithFooter;

    const data = maintenanceResult.data;
    const error = maintenanceResult.error;

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setMaintenanceEnabled(Boolean(data?.enabled));
    setMaintenanceMessageLine1(String(data?.message_line1 ?? "Estamos en mantenimiento"));
    setMaintenanceMessageLine2(String(data?.message_line2 ?? "Volvé en un rato"));
    setFooterLegend(String((data as { footer_legend?: unknown } | null)?.footer_legend ?? "LUGs App"));
    setDashboardSectionBalanceEnabled(Boolean((data as { show_balance?: unknown } | null)?.show_balance ?? true));
    setDashboardSectionListasEnabled(Boolean((data as { show_listas?: unknown } | null)?.show_listas ?? true));
    setDashboardSectionSetsEnabled(Boolean((data as { show_sets?: unknown } | null)?.show_sets ?? true));
    setDashboardSectionMinifigEnabled(Boolean((data as { show_minifiguras?: unknown } | null)?.show_minifiguras ?? true));
  }, [supabase, t.errorPrefix]);

  function openMaintenancePanel() {
    setMaintenanceDraftMessageLine1(maintenanceMessageLine1 || "");
    setMaintenanceDraftMessageLine2(maintenanceMessageLine2 || "");
    setMaintenanceDraftFooterLegend(footerLegend || "");
    setShowMaintenancePanel(true);
  }

  async function activateMaintenanceMode() {
    if (!supabase) {
      return;
    }

    const nextLine1 = maintenanceDraftMessageLine1.trim() || "Estamos en mantenimiento";
    const nextLine2 = maintenanceDraftMessageLine2.trim() || "Volvé en un rato";

    let { error } = await supabase
      .from("app_maintenance")
      .update({
        enabled: true,
        message_line1: nextLine1,
        message_line2: nextLine2,
        footer_legend: maintenanceDraftFooterLegend.trim() || footerLegend || "LUGs App",
      })
      .eq("id", 1);

    if (
      error &&
      (/column\s+"?footer_legend"?\s+does not exist/i.test(error.message) ||
        /could not find the 'footer_legend' column/i.test(error.message) ||
        error.code === "PGRST204")
    ) {
      const fallback = await supabase
        .from("app_maintenance")
        .update({
          enabled: true,
          message_line1: nextLine1,
          message_line2: nextLine2,
        })
        .eq("id", 1);
      error = fallback.error;
      if (!fallback.error) {
        setStatus(statusText.footerLegendMigrationMissing);
      }
    }

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setMaintenanceEnabled(true);
    setMaintenanceMessageLine1(nextLine1);
    setMaintenanceMessageLine2(nextLine2);
    setFooterLegend(maintenanceDraftFooterLegend.trim() || footerLegend || "LUGs App");
    setShowMaintenancePanel(false);
    setStatus(statusText.maintenanceEnabled);
  }

  async function disableMaintenanceMode() {
    if (!supabase) {
      return;
    }

    let { error } = await supabase
      .from("app_maintenance")
      .update({
        enabled: false,
        message_line1: maintenanceMessageLine1,
        message_line2: maintenanceMessageLine2,
        footer_legend: footerLegend,
      })
      .eq("id", 1);

    if (
      error &&
      (/column\s+"?footer_legend"?\s+does not exist/i.test(error.message) ||
        /could not find the 'footer_legend' column/i.test(error.message) ||
        error.code === "PGRST204")
    ) {
      const fallback = await supabase
        .from("app_maintenance")
        .update({
          enabled: false,
          message_line1: maintenanceMessageLine1,
          message_line2: maintenanceMessageLine2,
        })
        .eq("id", 1);
      error = fallback.error;
    }

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setMaintenanceEnabled(false);
    setStatus(statusText.maintenanceDisabled);
  }

  async function saveFooterLegendInMaster() {
    if (!supabase) {
      return;
    }

    const nextLegend = maintenanceDraftFooterLegend.trim() || "LUGs App";
    const { error } = await supabase.from("app_maintenance").update({ footer_legend: nextLegend }).eq("id", 1);

    if (
      error &&
      (/column\s+"?footer_legend"?\s+does not exist/i.test(error.message) ||
        /could not find the 'footer_legend' column/i.test(error.message) ||
        error.code === "PGRST204")
    ) {
      setStatus(statusText.footerLegendMigrationMissing);
      return;
    }

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setFooterLegend(nextLegend);
    setStatus(statusText.footerLegendSaved);
  }

  async function saveDashboardSectionsInMaster(nextValues: {
    show_balance: boolean;
    show_listas: boolean;
    show_sets: boolean;
    show_minifiguras: boolean;
  }) {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("app_maintenance").update(nextValues).eq("id", 1);

    if (
      error &&
      (/column\s+"?show_balance"?\s+does not exist/i.test(error.message) ||
        /column\s+"?show_listas"?\s+does not exist/i.test(error.message) ||
        /column\s+"?show_sets"?\s+does not exist/i.test(error.message) ||
        /column\s+"?show_minifiguras"?\s+does not exist/i.test(error.message) ||
        /could not find the 'show_balance' column/i.test(error.message) ||
        /could not find the 'show_listas' column/i.test(error.message) ||
        /could not find the 'show_sets' column/i.test(error.message) ||
        /could not find the 'show_minifiguras' column/i.test(error.message) ||
        error.code === "PGRST204")
    ) {
      setStatus("Falta migracion de DB para secciones del dashboard (0038_add_dashboard_sections_visibility_to_app_maintenance.sql).");
      return;
    }

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setDashboardSectionBalanceEnabled(nextValues.show_balance);
    setDashboardSectionListasEnabled(nextValues.show_listas);
    setDashboardSectionSetsEnabled(nextValues.show_sets);
    setDashboardSectionMinifigEnabled(nextValues.show_minifiguras);
    setStatus("Secciones del dashboard actualizadas.");
  }

  const loadListasFromDb = useCallback(async () => {
    if (!supabase || !userId) {
      setListasItems([]);
      setDashboardListsCreatedCount(0);
      return;
    }

    setListasLoading(true);

    const { data, error } = await supabase
      .from("lists")
      .select("list_id, name, list_type, is_public, list_items(quantity)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setListasLoading(false);
      return;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const parsed = rows.map((row) => {
      const items = Array.isArray(row.list_items) ? (row.list_items as Array<Record<string, unknown>>) : [];
      const lotes = items.length;
      const piezas = items.reduce((acc, item) => acc + Number(item.quantity ?? 0), 0);

      return {
        id: String(row.list_id ?? ""),
        nombre: String(row.name ?? ""),
        tipo: String(row.list_type ?? "deseos") === "venta" ? "venta" : "deseos",
        piezas,
        lotes,
        visibilidad: Boolean(row.is_public) ? "publico" : "privado",
      } as ListaItem;
    });

    setListasItems(parsed);
    setDashboardListsCreatedCount(parsed.length);
    listasLastLoadedAtRef.current = Date.now();
    setListasLoading(false);
  }, [supabase, t.errorPrefix, userId]);

  async function createListaItem() {
    if (!supabase || !userId) {
      return;
    }

    const nombre = newListaNombre.trim();
    if (!nombre) {
      setStatus(statusText.listNameRequired);
      return;
    }

    setListasSaving(true);

    const { error } = await supabase.from("lists").insert({
      owner_id: userId,
      lug_id: currentLugId,
      name: nombre,
      list_type: newListaTipo,
      is_public: false,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setListasSaving(false);
      return;
    }

    await loadListasFromDb();
    setShowCreateListaPanel(false);
    setNewListaNombre("");
    setNewListaTipo("deseos");
    setListasSaving(false);
  }

  async function setListaVisibilidad(listaId: string, visibilidad: ListaVisibilidad) {
    if (!supabase || !userId) {
      return;
    }

    setListasSaving(true);

    const { error } = await supabase
      .from("lists")
      .update({ is_public: visibilidad === "publico" })
      .eq("list_id", listaId)
      .eq("owner_id", userId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setListasSaving(false);
      return;
    }

    setListasItems((prev) => prev.map((item) => (item.id === listaId ? { ...item, visibilidad } : item)));
    setListasSaving(false);
  }

  function openDeleteListaConfirm(item: ListaItem) {
    if (item.nombre === AUTO_MINIFIG_MISSING_LIST_NAME) {
      setStatus("La lista automatica de CMF no se puede borrar.");
      return;
    }
    setListaToDelete(item);
    setShowDeleteListaConfirmPanel(true);
  }

  async function deleteListaConfirmed() {
    if (!supabase || !userId || !listaToDelete) {
      return;
    }

    if (listaToDelete.nombre === AUTO_MINIFIG_MISSING_LIST_NAME) {
      setStatus("La lista automatica de CMF no se puede borrar.");
      return;
    }

    setListasSaving(true);

    const { error } = await supabase
      .from("lists")
      .delete()
      .eq("list_id", listaToDelete.id)
      .eq("owner_id", userId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setListasSaving(false);
      return;
    }

    setListasItems((prev) => prev.filter((item) => item.id !== listaToDelete.id));
    setShowDeleteListaConfirmPanel(false);
    setListaToDelete(null);
    setListasSaving(false);
  }

  const loadPartsCategories = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("part_categories")
      .select("id, name, part_count")
      .order("name", { ascending: true });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    setPartsCategories(
      rows.map((row) => ({
        id: Number(row.id ?? 0),
        name: String(row.name ?? ""),
        part_count: Number(row.part_count ?? 0),
      })),
    );
    partCategoriesLastLoadedAtRef.current = Date.now();
  }, [supabase, t.errorPrefix]);

  const openListasSection = useCallback(async (options?: { navigate?: boolean }) => {
    if (options?.navigate !== false) {
      navigateSectionClient("listas", "/listas");
    } else {
      setActiveSection("listas");
    }
    const now = Date.now();
    const shouldRefreshLists = listasItems.length === 0 || now - listasLastLoadedAtRef.current > SECTION_DATA_CACHE_MS;
    const shouldRefreshCategories = partsCategories.length === 0 || now - partCategoriesLastLoadedAtRef.current > SECTION_DATA_CACHE_MS;
    const tasks: Promise<void>[] = [];
    if (shouldRefreshLists) {
      tasks.push(loadListasFromDb());
    }
    if (shouldRefreshCategories) {
      tasks.push(loadPartsCategories());
    }
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }, [listasItems.length, loadListasFromDb, loadPartsCategories, navigateSectionClient, partsCategories.length]);

  const loadMinifigMissingAnalysisBySetNums = useCallback(
    async (setNums: string[]): Promise<MinifigMissingAnalysisResult> => {
      const uniqueSetNums = Array.from(new Set(setNums.map((setNum) => String(setNum).trim()).filter(Boolean)));
      const missingBySetNum: Record<string, boolean> = {};
      for (const setNum of uniqueSetNums) {
        missingBySetNum[setNum] = false;
      }

      if (!supabase || !userId || uniqueSetNums.length === 0) {
        return {
          missingBySetNum,
          missingPieceCount: 0,
          missingRows: [],
          hadError: false,
        };
      }

      const [{ data: requiredRows, error: requiredError }, { data: ownedRows, error: ownedError }] = await Promise.all([
        supabase
          .from("minifigure_set_parts_catalog")
          .select("set_num, part_num, part_name, color_name, quantity")
          .in("set_num", uniqueSetNums),
        supabase
          .from("minifig_user_part_inventory")
          .select("set_num, part_num, color_name, owned_quantity")
          .eq("user_id", userId)
          .in("set_num", uniqueSetNums),
      ]);

      if (requiredError) {
        setStatus(`${t.errorPrefix}: ${requiredError.message}`);
        return {
          missingBySetNum,
          missingPieceCount: 0,
          missingRows: [],
          hadError: true,
        };
      }

      if (ownedError) {
        setStatus(`${t.errorPrefix}: ${ownedError.message}`);
        return {
          missingBySetNum,
          missingPieceCount: 0,
          missingRows: [],
          hadError: true,
        };
      }

      const ownedByKey = new Map<string, number>();
      const setsWithTrackedParts = new Set<string>();
      for (const row of ownedRows ?? []) {
        const setNum = String((row as { set_num?: unknown }).set_num ?? "").trim();
        const partNum = String((row as { part_num?: unknown }).part_num ?? "").trim();
        const colorName = String((row as { color_name?: unknown }).color_name ?? "").trim();
        const ownedQty = Math.max(0, Number((row as { owned_quantity?: unknown }).owned_quantity ?? 0) || 0);
        if (!setNum || !partNum) continue;
        setsWithTrackedParts.add(setNum);
        const key = `${setNum}::${partNum}::${colorName}`;
        ownedByKey.set(key, (ownedByKey.get(key) ?? 0) + ownedQty);
      }

      const requiredByKey = new Map<string, { set_num: string; part_num: string; part_name: string; color_name: string; quantity: number }>();
      for (const row of requiredRows ?? []) {
        const setNum = String((row as { set_num?: unknown }).set_num ?? "").trim();
        const partNum = String((row as { part_num?: unknown }).part_num ?? "").trim();
        const partName = String((row as { part_name?: unknown }).part_name ?? partNum).trim();
        const colorName = String((row as { color_name?: unknown }).color_name ?? "").trim();
        const requiredQty = Math.max(0, Number((row as { quantity?: unknown }).quantity ?? 0) || 0);
        if (!setNum || !partNum || requiredQty <= 0) continue;

        const key = `${setNum}::${partNum}::${colorName}`;
        const current = requiredByKey.get(key);
        if (current) {
          current.quantity += requiredQty;
          if (!current.part_name && partName) {
            current.part_name = partName;
          }
        } else {
          requiredByKey.set(key, {
            set_num: setNum,
            part_num: partNum,
            part_name: partName || partNum,
            color_name: colorName,
            quantity: requiredQty,
          });
        }
      }

      let missingPieceCount = 0;
      const missingRows: MinifigMissingAnalysisRow[] = [];
      for (const row of requiredByKey.values()) {
        const isTrackedSet = setsWithTrackedParts.has(row.set_num);
        const ownedQty = ownedByKey.get(`${row.set_num}::${row.part_num}::${row.color_name}`) ?? (isTrackedSet ? 0 : row.quantity);
        const missingQty = Math.max(0, row.quantity - ownedQty);
        if (missingQty <= 0) {
          continue;
        }

        missingBySetNum[row.set_num] = true;
        missingPieceCount += missingQty;
        missingRows.push({
          set_num: row.set_num,
          part_num: row.part_num,
          part_name: row.part_name || row.part_num,
          color_name: row.color_name,
          missing_quantity: missingQty,
        });
      }

      return {
        missingBySetNum,
        missingPieceCount,
        missingRows,
        hadError: false,
      };
    },
    [supabase, t.errorPrefix, userId],
  );

  const computeMinifigMissingBySetNums = useCallback(
    async (setNums: string[]) => {
      const result = await loadMinifigMissingAnalysisBySetNums(setNums);
      if (result.hadError) {
        return {} as Record<string, boolean>;
      }
      return result.missingBySetNum;
    },
    [loadMinifigMissingAnalysisBySetNums],
  );

  const loadCollectibleSeries = useCallback(async () => {
    setMinifigSeriesLoading(true);
    setMinifigSeriesProgressById({});

    try {
      const authHeaders = await getSupabaseAuthHeaders();
      const response = await fetch("/api/minifigures/themes", { cache: "no-store", headers: authHeaders });
      const payload = (await response.json()) as {
        error?: string;
        results?: Array<CollectibleSeriesItem>;
      };

      if (!response.ok) {
        setStatus(payload.error || `${t.errorPrefix}: collectible series`);
        setMinifigSeriesRows([]);
        setMinifigSeriesLoading(false);
        return;
      }

      const rows = Array.isArray(payload.results)
        ? payload.results
            .map((row) => ({
              id: Number(row.id ?? 0),
              name: String(row.name ?? ""),
              year_from: row.year_from == null ? null : Number(row.year_from),
              year_to: row.year_to == null ? null : Number(row.year_to),
              set_count: Number(row.set_count ?? 0),
            }))
            .filter((row) => row.id > 0 && row.name)
          : [];

      setMinifigSeriesRows(rows);
      setMinifigSeriesProgressById(
        rows.reduce<Record<number, { owned: number; total: number }>>((acc, row) => {
          acc[row.id] = { owned: 0, total: Math.max(0, Number(row.set_count ?? 0) || 0) };
          return acc;
        }, {}),
      );

      if (supabase && userId && rows.length > 0) {
        const themeIds = Array.from(new Set(rows.map((row) => row.id)));
        const [{ data: prefRows, error: prefError }, { data: setsRows, error: setsError }] = await Promise.all([
          supabase
            .from("minifig_user_series_preferences")
            .select("theme_id, is_selected, is_favorite")
            .eq("user_id", userId)
            .in("theme_id", themeIds),
          supabase
            .from("minifigure_sets_catalog")
            .select("set_num, theme_id, name, num_parts")
            .in("theme_id", themeIds),
        ]);

        if (!prefError) {
          const checkedMap: Record<number, boolean> = {};
          const favoriteMap: Record<number, boolean> = {};
          for (const row of prefRows ?? []) {
            const themeId = Number((row as { theme_id?: unknown }).theme_id ?? 0);
            if (!themeId) continue;
            checkedMap[themeId] = Boolean((row as { is_selected?: unknown }).is_selected);
            favoriteMap[themeId] = Boolean((row as { is_favorite?: unknown }).is_favorite);
          }
          setMinifigSeriesCheckedById((prev) => ({ ...prev, ...checkedMap }));
          setMinifigSeriesFavoriteById((prev) => ({ ...prev, ...favoriteMap }));
        }

        if (!setsError) {
          const setsByThemeId = new Map<number, Set<string>>();
          const allSetNums = new Set<string>();
          for (const row of setsRows ?? []) {
            const themeId = Number((row as { theme_id?: unknown }).theme_id ?? 0);
            const setNum = String((row as { set_num?: unknown }).set_num ?? "").trim();
            const setName = String((row as { name?: unknown }).name ?? "").toLowerCase();
            const setNumParts = Math.max(0, Number((row as { num_parts?: unknown }).num_parts ?? 0) || 0);
            const hasPackagingKeywords = /\b(?:box|pack)\b/.test(setName);
            if (!themeId || !setNum) continue;
            if (
              setName.includes("complete") ||
              setName.includes("random bag") ||
              setName.includes("sealed box") ||
              setName.includes("random box") ||
              hasPackagingKeywords ||
              setNumParts <= 0
            ) {
              continue;
            }
            if (!setsByThemeId.has(themeId)) {
              setsByThemeId.set(themeId, new Set<string>());
            }
            setsByThemeId.get(themeId)?.add(setNum);
            allSetNums.add(setNum);
          }

          const setNums = Array.from(allSetNums);
          const [{ data: inventoryData, error: inventoryError }, missingAnalysis] = await Promise.all([
            setNums.length > 0
              ? supabase.from("minifig_user_inventory").select("set_num, is_owned").eq("user_id", userId).in("set_num", setNums)
              : Promise.resolve({ data: [], error: null }),
            loadMinifigMissingAnalysisBySetNums(setNums),
          ]);

          if (inventoryError) {
            setStatus(`${t.errorPrefix}: ${inventoryError.message}`);
          }

          const ownedBySetNum = new Map<string, boolean>();
          for (const row of inventoryData ?? []) {
            const setNum = String((row as { set_num?: unknown }).set_num ?? "").trim();
            if (!setNum) continue;
            ownedBySetNum.set(setNum, Boolean((row as { is_owned?: unknown }).is_owned));
          }

          const progressByThemeId: Record<number, { owned: number; total: number }> = {};
          for (const series of rows) {
            const setNumsForSeries = Array.from(setsByThemeId.get(series.id) ?? new Set<string>());
            const owned = setNumsForSeries.reduce((acc, setNum) => {
              const isOwned = Boolean(ownedBySetNum.get(setNum));
              const hasMissing = Boolean(missingAnalysis.missingBySetNum[setNum]);
              return isOwned || hasMissing ? acc + 1 : acc;
            }, 0);
            progressByThemeId[series.id] = {
              owned,
              total: setNumsForSeries.length,
            };
          }
          setMinifigSeriesProgressById(progressByThemeId);
        }
      }

      minifigSeriesLastLoadedAtRef.current = Date.now();
      setMinifigSeriesLoading(false);
    } catch (error) {
      setStatus(`${t.errorPrefix}: ${(error as Error).message}`);
      setMinifigSeriesRows([]);
      setMinifigSeriesLoading(false);
    }
  }, [getSupabaseAuthHeaders, loadMinifigMissingAnalysisBySetNums, supabase, t.errorPrefix, userId]);

  const checkedMinifigSeriesIds = useMemo(
    () => Object.entries(minifigSeriesCheckedById).filter(([, checked]) => checked).map(([id]) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
    [minifigSeriesCheckedById],
  );
  const minifigContextFigureSetNums = useMemo(() => {
    if (minifigSearchQuery.trim().length > 0) {
      return Array.from(new Set(minifigSearchResults.map((fig) => fig.set_num).filter(Boolean)));
    }

    const setNums = checkedMinifigSeriesIds.flatMap((seriesId) =>
      (minifigFiguresBySeriesId[seriesId] ?? []).map((fig) => fig.set_num).filter(Boolean),
    );
    return Array.from(new Set(setNums));
  }, [checkedMinifigSeriesIds, minifigFiguresBySeriesId, minifigSearchQuery, minifigSearchResults]);
  const minifigContextMissingSetNums = useMemo(
    () => minifigContextFigureSetNums.filter((setNum) => Boolean(minifigSetHasMissingPartsBySetNum[setNum])),
    [minifigContextFigureSetNums, minifigSetHasMissingPartsBySetNum],
  );
  const popupVisibleSeriesRows = useMemo(
    () => (showOnlyFavoriteSeries ? minifigSeriesRows.filter((series) => Boolean(minifigSeriesFavoriteById[series.id])) : minifigSeriesRows),
    [minifigSeriesFavoriteById, minifigSeriesRows, showOnlyFavoriteSeries],
  );

  const loadMinifigSearchResults = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      if (!supabase || !query) {
        setMinifigSearchResults([]);
        setMinifigSearchLoading(false);
        return;
      }

      setMinifigSearchLoading(true);

      const { data, error } = await supabase
        .from("minifigure_sets_catalog")
        .select("set_num, name, set_img_url, num_parts, year, theme_id")
        .or(`name.ilike.%${query}%,set_num.ilike.%${query}%`)
        .order("name", { ascending: true })
        .limit(400);

      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
        setMinifigSearchResults([]);
        setMinifigSearchLoading(false);
        return;
      }

      const rows = (data ?? [])
        .map((row) => ({
          set_num: String(row.set_num ?? ""),
          name: String(row.name ?? ""),
          set_img_url: row.set_img_url ? String(row.set_img_url) : null,
          num_parts: Number(row.num_parts ?? 0),
          year: row.year == null ? null : Number(row.year),
          theme_id: row.theme_id == null ? null : Number(row.theme_id),
        }))
        .filter((row) => row.set_num && row.name);

      setMinifigSearchResults(rows);

      if (userId && rows.length > 0) {
        const setNums = Array.from(new Set(rows.map((row) => row.set_num)));
        const [{ data: inventoryData }, missingPartsMap] = await Promise.all([
          supabase.from("minifig_user_inventory").select("set_num, is_owned, is_favorite").eq("user_id", userId).in("set_num", setNums),
          computeMinifigMissingBySetNums(setNums),
        ]);

        const ownedMap: Record<string, boolean> = {};
        const favoriteMap: Record<string, boolean> = {};
        for (const row of inventoryData ?? []) {
          const setNum = String((row as { set_num?: unknown }).set_num ?? "");
          ownedMap[setNum] = Boolean((row as { is_owned?: unknown }).is_owned);
          favoriteMap[setNum] = Boolean((row as { is_favorite?: unknown }).is_favorite);
        }
        setMinifigFigureCheckedBySetNum((prev) => ({ ...prev, ...ownedMap }));
        setMinifigFigureFavoriteBySetNum((prev) => ({ ...prev, ...favoriteMap }));
        setMinifigSetHasMissingPartsBySetNum((prev) => ({ ...prev, ...missingPartsMap }));
      }

      setMinifigSearchLoading(false);
    },
    [computeMinifigMissingBySetNums, supabase, t.errorPrefix, userId],
  );

  const loadMinifigGlobalOwnedStats = useCallback(async () => {
    if (!supabase || !userId) {
      setMinifigGlobalOwnedStats({ complete: 0, missing: 0, total: 0, favorites: 0 });
      setMinifigGlobalMissingPiecesCount(0);
      return;
    }

    const { data: statsData, error: statsError } = await supabase.rpc("get_minifig_user_stats_current", { p_user_id: userId });
    const statsRow = !statsError ? (Array.isArray(statsData) ? statsData[0] : statsData) : null;

    if (statsRow) {
      const complete = Math.max(0, Number((statsRow as { complete_count?: unknown }).complete_count ?? 0) || 0);
      const missing = Math.max(0, Number((statsRow as { missing_count?: unknown }).missing_count ?? 0) || 0);
      const missingPieces = Math.max(0, Number((statsRow as { missing_pieces_count?: unknown }).missing_pieces_count ?? 0) || 0);
      const total = Math.max(0, Number((statsRow as { total_count?: unknown }).total_count ?? 0) || 0);
      const favorites = Math.max(0, Number((statsRow as { favorites_count?: unknown }).favorites_count ?? 0) || 0);
      setMinifigGlobalOwnedStats({ complete, missing, total, favorites });
      setMinifigGlobalMissingPiecesCount(missingPieces);
      return;
    }

    const [{ data: inventoryRows, error: inventoryError }, { data: trackedPartRows, error: trackedPartError }] = await Promise.all([
      supabase
        .from("minifig_user_inventory")
        .select("set_num, is_owned, is_favorite")
        .eq("user_id", userId),
      supabase
        .from("minifig_user_part_inventory")
        .select("set_num")
        .eq("user_id", userId),
    ]);

    if (inventoryError) {
      setStatus(`${t.errorPrefix}: ${inventoryError.message}`);
      return;
    }

    if (trackedPartError) {
      setStatus(`${t.errorPrefix}: ${trackedPartError.message}`);
      return;
    }

    const favorites = (inventoryRows ?? []).reduce(
      (acc, row) => (Boolean((row as { is_favorite?: unknown }).is_favorite) ? acc + 1 : acc),
      0,
    );

    const ownedSetNums = Array.from(
      new Set(
        (inventoryRows ?? [])
          .filter((row) => Boolean((row as { is_owned?: unknown }).is_owned))
          .map((row) => String((row as { set_num?: unknown }).set_num ?? ""))
          .filter(Boolean),
      ),
    );
    const missingCandidateSetNums = Array.from(
      new Set([
        ...(inventoryRows ?? []).map((row) => String((row as { set_num?: unknown }).set_num ?? "")).filter(Boolean),
        ...(trackedPartRows ?? []).map((row) => String((row as { set_num?: unknown }).set_num ?? "")).filter(Boolean),
      ]),
    );

    const missingAnalysis = await loadMinifigMissingAnalysisBySetNums(missingCandidateSetNums);
    if (missingAnalysis.hadError) {
      return;
    }

    setMinifigGlobalMissingPiecesCount(missingAnalysis.missingPieceCount);

    const total = ownedSetNums.length;
    const missingOwnedSetCount = ownedSetNums.reduce(
      (acc, setNum) => (missingAnalysis.missingBySetNum[setNum] ? acc + 1 : acc),
      0,
    );
    const missing = Object.values(missingAnalysis.missingBySetNum).reduce((acc, hasMissing) => (hasMissing ? acc + 1 : acc), 0);
    const complete = Math.max(0, total - missingOwnedSetCount);
    setMinifigGlobalOwnedStats({ complete, missing, total, favorites });
  }, [loadMinifigMissingAnalysisBySetNums, supabase, t.errorPrefix, userId]);

  const loadUnreadChatsCount = useCallback(async () => {
    if (!supabase || !userId) {
      setUnreadChatsCount(0);
      return;
    }

    const { data, error } = await supabase.rpc("chat_list_rooms_current", { p_limit: 300 });
    if (error) {
      setUnreadChatsCount(0);
      return;
    }

    const totalUnread = ((data ?? []) as Array<Record<string, unknown>>).reduce((acc, row) => {
      const value = Math.max(0, Number(row.unread_count ?? 0) || 0);
      return acc + value;
    }, 0);

    setUnreadChatsCount(totalUnread);
  }, [supabase, userId]);

  const openUnreadChatsPanel = useCallback(async () => {
    if (!supabase || !userId) {
      return;
    }

    setShowUnreadChatsPopup(true);
    setUnreadChatsPopupLoading(true);

    const { data, error } = await supabase.rpc("chat_list_rooms_current", { p_limit: 300 });
    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setUnreadChatsRooms([]);
      setUnreadChatsPopupLoading(false);
      return;
    }

    const rows: UnreadChatRoomAlertItem[] = ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => {
        const participantIds = Array.isArray(row.participant_ids)
          ? (row.participant_ids as unknown[]).map((value) => String(value ?? "").trim()).filter(Boolean)
          : [];
        const roomUserId = String(userId ?? "").trim().toLowerCase();
        const peerUserId = roomUserId && participantIds.length === 2
          ? participantIds.find((id) => String(id).toLowerCase() !== roomUserId) ?? null
          : null;

        return {
          room_id: String(row.room_id ?? "").trim(),
          room_type: String(row.room_type ?? "group").trim(),
          room_name: (() => {
            const value = String(row.room_name ?? "").trim();
            return value || null;
          })(),
          participant_ids: participantIds,
          peer_user_id: peerUserId,
          unread_count: Math.max(0, Number(row.unread_count ?? 0) || 0),
          last_message_content: (() => {
            const value = String(row.last_message_content ?? "");
            return value || null;
          })(),
          last_message_at: (() => {
            const value = String(row.last_message_at ?? "").trim();
            return value || null;
          })(),
        };
      })
      .filter((row) => row.room_id);

    setUnreadChatsRooms(rows);

    const idsToResolve = Array.from(
      new Set(
        rows
          .flatMap((room) => (room.peer_user_id ? [room.peer_user_id] : []))
          .map((id) => String(id).trim())
          .filter((id) => id && id !== userId),
      ),
    );

    if (idsToResolve.length > 0) {
      const authHeaders = await getSupabaseAuthHeaders();
      const namesResponse = await fetch("/api/profiles/names", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeaders ?? {}),
        },
        body: JSON.stringify({ ids: idsToResolve }),
      });

      const payload = (await namesResponse.json().catch(() => ({}))) as { names?: Record<string, string> };
      if (payload.names) {
        setUnreadChatNameByUserId((prev) => ({ ...prev, ...payload.names }));
      }
    }

    setUnreadChatsPopupLoading(false);
  }, [getSupabaseAuthHeaders, supabase, t.errorPrefix, userId]);

  const saveMinifigUiPreferences = useCallback(
    async (patch: { show_only_favorite_series?: boolean; show_only_favorite_figures?: boolean }) => {
      if (!supabase || !userId) {
        return;
      }

      const payload = {
        user_id: userId,
        show_only_favorite_series: patch.show_only_favorite_series ?? showOnlyFavoriteSeries,
        show_only_favorite_figures: patch.show_only_favorite_figures ?? showOnlyFavoriteFigures,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("minifig_user_ui_preferences").upsert(payload, { onConflict: "user_id" });
      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
      }
    },
    [showOnlyFavoriteFigures, showOnlyFavoriteSeries, supabase, t.errorPrefix, userId],
  );

  const saveMinifigSeriesPreference = useCallback(
    async (themeId: number, patch: { is_selected?: boolean; is_favorite?: boolean }) => {
      if (!supabase || !userId || !themeId) {
        return;
      }

      const payload = {
        user_id: userId,
        theme_id: themeId,
        is_selected: patch.is_selected ?? Boolean(minifigSeriesCheckedById[themeId]),
        is_favorite: patch.is_favorite ?? Boolean(minifigSeriesFavoriteById[themeId]),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("minifig_user_series_preferences").upsert(payload, { onConflict: "user_id,theme_id" });
      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
      }
    },
    [minifigSeriesCheckedById, minifigSeriesFavoriteById, supabase, t.errorPrefix, userId],
  );

  const loadMissingPartsPreviewForSet = useCallback(
    async (setNum: string) => {
      if (!supabase || !userId || !setNum) {
        return;
      }

      if (minifigMissingPartsPreviewLoadingBySetNum[setNum] || minifigMissingPartsPreviewBySetNum[setNum]) {
        return;
      }

      setMinifigMissingPartsPreviewLoadingBySetNum((prev) => ({ ...prev, [setNum]: true }));

      try {
        const encodedSetNum = encodeURIComponent(setNum);
        const authHeaders = await getSupabaseAuthHeaders();
        const response = await fetch(`/api/minifigures/sets/${encodedSetNum}/parts`, { cache: "no-store", headers: authHeaders });
        const payload = (await response.json()) as {
          error?: string;
          results?: Array<MinifigFigurePartItem>;
        };

        if (!response.ok) {
          setStatus(payload.error || `${t.errorPrefix}: minifigure parts`);
          setMinifigMissingPartsPreviewLoadingBySetNum((prev) => ({ ...prev, [setNum]: false }));
          return;
        }

        const rows = Array.isArray(payload.results)
          ? payload.results
              .map((row) => ({
                row_id: "",
                part_num: String(row.part_num ?? ""),
                part_name: String(row.part_name ?? ""),
                color_name: String(row.color_name ?? ""),
                part_img_url: row.part_img_url ? String(row.part_img_url) : null,
                quantity: Math.max(1, Number(row.quantity ?? 1)),
              }))
              .filter((row) => row.part_num)
          : [];

        const { data: partInventoryData, error: partInventoryError } = await supabase
          .from("minifig_user_part_inventory")
          .select("part_num, color_name, owned_quantity")
          .eq("user_id", userId)
          .eq("set_num", setNum);

        if (partInventoryError) {
          setStatus(`${t.errorPrefix}: ${partInventoryError.message}`);
          setMinifigMissingPartsPreviewLoadingBySetNum((prev) => ({ ...prev, [setNum]: false }));
          return;
        }

        const ownedByKey = new Map<string, number>();
        for (const row of partInventoryData ?? []) {
          const partNum = String((row as { part_num?: unknown }).part_num ?? "");
          const colorName = String((row as { color_name?: unknown }).color_name ?? "");
          const qty = Math.max(0, Number((row as { owned_quantity?: unknown }).owned_quantity ?? 0) || 0);
          ownedByKey.set(`${partNum}::${colorName}`, qty);
        }

        const missingRows = rows.flatMap((row) => {
          const key = `${row.part_num}::${row.color_name}`;
          const ownedQty = ownedByKey.get(key) ?? row.quantity;
          const missingQty = Math.max(0, row.quantity - ownedQty);
          return Array.from({ length: missingQty }, (_, index) => ({
            ...row,
            row_id: `${setNum}::${row.part_num}::${row.color_name}::${index}`,
            quantity: 1,
          }));
        });

        setMinifigMissingPartsPreviewBySetNum((prev) => ({
          ...prev,
          [setNum]: missingRows,
        }));
      } catch (error) {
        setStatus(`${t.errorPrefix}: ${(error as Error).message}`);
      } finally {
        setMinifigMissingPartsPreviewLoadingBySetNum((prev) => ({ ...prev, [setNum]: false }));
      }
    },
    [getSupabaseAuthHeaders, minifigMissingPartsPreviewBySetNum, minifigMissingPartsPreviewLoadingBySetNum, supabase, t.errorPrefix, userId],
  );

  const loadMinifigFiguresForSeries = useCallback(
    async (seriesId: number) => {
      if (minifigFiguresLoadingBySeriesId[seriesId]) {
        return;
      }

      setMinifigFiguresLoadingBySeriesId((prev) => ({ ...prev, [seriesId]: true }));
      try {
        const authHeaders = await getSupabaseAuthHeaders();
        const response = await fetch(`/api/minifigures/themes/${seriesId}/figures`, { cache: "no-store", headers: authHeaders });
        const payload = (await response.json()) as {
          error?: string;
          results?: Array<MinifigFigureItem>;
        };

        if (!response.ok) {
          setStatus(payload.error || `${t.errorPrefix}: minifigure figures`);
          setMinifigFiguresBySeriesId((prev) => ({ ...prev, [seriesId]: [] }));
          setMinifigFiguresLoadingBySeriesId((prev) => ({ ...prev, [seriesId]: false }));
          return;
        }

        const rows = Array.isArray(payload.results)
          ? payload.results
              .map((row) => ({
                set_num: String(row.set_num ?? ""),
                name: String(row.name ?? ""),
                set_img_url: row.set_img_url ? String(row.set_img_url) : null,
                num_parts: Number(row.num_parts ?? 0),
                year: row.year == null ? null : Number(row.year),
                theme_id: row.theme_id == null ? null : Number(row.theme_id),
              }))
              .filter((row) => row.set_num && row.name)
          : [];

        setMinifigFiguresBySeriesId((prev) => ({ ...prev, [seriesId]: rows }));

        if (supabase && userId && rows.length > 0) {
          const setNums = Array.from(new Set(rows.map((row) => row.set_num)));
          const [{ data: inventoryData }, missingPartsMap] = await Promise.all([
            supabase
              .from("minifig_user_inventory")
              .select("set_num, is_owned, is_favorite")
              .eq("user_id", userId)
              .in("set_num", setNums),
            computeMinifigMissingBySetNums(setNums),
          ]);

          const ownedMap: Record<string, boolean> = {};
          const favoriteMap: Record<string, boolean> = {};
          for (const row of inventoryData ?? []) {
            const setNum = String((row as { set_num?: unknown }).set_num ?? "");
            ownedMap[setNum] = Boolean((row as { is_owned?: unknown }).is_owned);
            favoriteMap[setNum] = Boolean((row as { is_favorite?: unknown }).is_favorite);
          }
          setMinifigFigureCheckedBySetNum((prev) => ({ ...prev, ...ownedMap }));
          setMinifigFigureFavoriteBySetNum((prev) => ({ ...prev, ...favoriteMap }));
          setMinifigSetHasMissingPartsBySetNum((prev) => ({ ...prev, ...missingPartsMap }));

          const missingSetNums = setNums.filter((setNum) => Boolean(missingPartsMap[setNum]));
          if (missingSetNums.length > 0) {
            for (const setNum of missingSetNums) {
              void loadMissingPartsPreviewForSet(setNum);
            }
          }
        }

        setMinifigFiguresLoadingBySeriesId((prev) => ({ ...prev, [seriesId]: false }));
      } catch (error) {
        setStatus(`${t.errorPrefix}: ${(error as Error).message}`);
        setMinifigFiguresBySeriesId((prev) => ({ ...prev, [seriesId]: [] }));
        setMinifigFiguresLoadingBySeriesId((prev) => ({ ...prev, [seriesId]: false }));
      }
    },
    [computeMinifigMissingBySetNums, getSupabaseAuthHeaders, loadMissingPartsPreviewForSet, minifigFiguresLoadingBySeriesId, supabase, t.errorPrefix, userId],
  );

  const saveMinifigSetOwnedState = useCallback(
    async (setNum: string, isOwned: boolean) => {
      if (!supabase || !userId) {
        return;
      }

      const { error } = await supabase.from("minifig_user_inventory").upsert(
        {
          user_id: userId,
          set_num: setNum,
          is_owned: isOwned,
          is_favorite: Boolean(minifigFigureFavoriteBySetNum[setNum]),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,set_num" },
      );

      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
        return;
      }

      await loadMinifigGlobalOwnedStats();
    },
    [loadMinifigGlobalOwnedStats, minifigFigureFavoriteBySetNum, supabase, t.errorPrefix, userId],
  );

  const saveMinifigSetFavoriteState = useCallback(
    async (setNum: string, isFavorite: boolean) => {
      if (!supabase || !userId) {
        return;
      }

      const { error } = await supabase.from("minifig_user_inventory").upsert(
        {
          user_id: userId,
          set_num: setNum,
          is_owned: Boolean(minifigFigureCheckedBySetNum[setNum]),
          is_favorite: isFavorite,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,set_num" },
      );

      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
      }
    },
    [minifigFigureCheckedBySetNum, supabase, t.errorPrefix, userId],
  );

  const saveMinifigPartsInventoryState = useCallback(
    async (setNum: string, checkedByRowId: Record<string, boolean>) => {
      if (!supabase || !userId) {
        return;
      }

      const grouped = new Map<string, { part_num: string; color_name: string; owned_quantity: number }>();
      for (const row of minifigPartsRows) {
        const key = `${row.part_num}::${row.color_name}`;
        const current = grouped.get(key);
        const isChecked = checkedByRowId[row.row_id] !== false;
        if (current) {
          current.owned_quantity += isChecked ? 1 : 0;
        } else {
          grouped.set(key, {
            part_num: row.part_num,
            color_name: row.color_name || "",
            owned_quantity: isChecked ? 1 : 0,
          });
        }
      }

      const payload = Array.from(grouped.values()).map((row) => ({
        user_id: userId,
        set_num: setNum,
        part_num: row.part_num,
        color_name: row.color_name,
        owned_quantity: row.owned_quantity,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("minifig_user_part_inventory").upsert(payload, {
        onConflict: "user_id,set_num,part_num,color_name",
      });

      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
        return;
      }

      await loadMinifigGlobalOwnedStats();
    },
    [loadMinifigGlobalOwnedStats, minifigPartsRows, supabase, t.errorPrefix, userId],
  );

  const openMinifigFigureParts = useCallback(
    async (figure: MinifigFigureItem) => {
      setSelectedMinifigForParts(figure);
      setShowMinifigPartsPopup(true);
      setMinifigPartsLoading(true);

      try {
        const encodedSetNum = encodeURIComponent(figure.set_num);
        const authHeaders = await getSupabaseAuthHeaders();
        const response = await fetch(`/api/minifigures/sets/${encodedSetNum}/parts`, { cache: "no-store", headers: authHeaders });
        const payload = (await response.json()) as {
          error?: string;
          results?: Array<MinifigFigurePartItem>;
        };

        if (!response.ok) {
          setStatus(payload.error || `${t.errorPrefix}: minifigure parts`);
          setMinifigPartsRows([]);
          setMinifigPartsLoading(false);
          return;
        }

        const rows = Array.isArray(payload.results)
          ? payload.results
              .map((row) => ({
                row_id: "",
                part_num: String(row.part_num ?? ""),
                part_name: String(row.part_name ?? ""),
                color_name: String(row.color_name ?? ""),
                part_img_url: row.part_img_url ? String(row.part_img_url) : null,
                quantity: Math.max(1, Number(row.quantity ?? 1)),
              }))
              .filter((row) => row.part_num)
          : [];

        const expandedRows = rows.flatMap((row) =>
          Array.from({ length: row.quantity }, (_, index) => ({
            ...row,
            row_id: `${row.part_num}::${row.color_name}::${index}`,
            quantity: 1,
          })),
        );
        setMinifigPartsRows(expandedRows);

        if (supabase && userId) {
          const uniquePartNums = Array.from(new Set(expandedRows.map((row) => row.part_num)));
          const { data: partInventoryData } = await supabase
            .from("minifig_user_part_inventory")
            .select("part_num, color_name, owned_quantity")
            .eq("user_id", userId)
            .eq("set_num", figure.set_num)
            .in("part_num", uniquePartNums);

          const ownedByKey = new Map<string, number>();
          for (const row of partInventoryData ?? []) {
            const partNum = String((row as { part_num?: unknown }).part_num ?? "");
            const colorName = String((row as { color_name?: unknown }).color_name ?? "");
            const qty = Math.max(0, Number((row as { owned_quantity?: unknown }).owned_quantity ?? 0) || 0);
            ownedByKey.set(getMinifigPartInventoryKey(figure.set_num, partNum, colorName), qty);
          }

          const nextCheckedMap: Record<string, boolean> = {};
          const usedByKey = new Map<string, number>();
          for (const partRow of expandedRows) {
            const inventoryKey = getMinifigPartInventoryKey(figure.set_num, partRow.part_num, partRow.color_name);
            const used = usedByKey.get(inventoryKey) ?? 0;
            const ownedQty = ownedByKey.get(inventoryKey) ?? expandedRows.filter((candidate) => candidate.part_num === partRow.part_num && candidate.color_name === partRow.color_name).length;
            nextCheckedMap[partRow.row_id] = used < ownedQty;
            usedByKey.set(inventoryKey, used + 1);
          }
          setMinifigPartCheckedByRowId(nextCheckedMap);
          setMinifigSetHasMissingPartsBySetNum((prev) => ({
            ...prev,
            [figure.set_num]: Object.values(nextCheckedMap).some((checked) => !checked),
          }));
          setMinifigMissingPartsPreviewBySetNum((prev) => ({
            ...prev,
            [figure.set_num]: getMissingMinifigPartRows(expandedRows, nextCheckedMap),
          }));

          if ((partInventoryData ?? []).length === 0) {
            const groupedDefaults = new Map<string, { part_num: string; color_name: string; owned_quantity: number }>();
            for (const partRow of expandedRows) {
              const key = `${partRow.part_num}::${partRow.color_name}`;
              const current = groupedDefaults.get(key);
              if (current) {
                current.owned_quantity += 1;
              } else {
                groupedDefaults.set(key, {
                  part_num: partRow.part_num,
                  color_name: partRow.color_name,
                  owned_quantity: 1,
                });
              }
            }

            const seedPayload = Array.from(groupedDefaults.values()).map((row) => ({
              user_id: userId,
              set_num: figure.set_num,
              part_num: row.part_num,
              color_name: row.color_name,
              owned_quantity: row.owned_quantity,
              updated_at: new Date().toISOString(),
            }));

            if (seedPayload.length > 0) {
              const { error: seedError } = await supabase.from("minifig_user_part_inventory").upsert(seedPayload, {
                onConflict: "user_id,set_num,part_num,color_name",
              });
              if (seedError) {
                setStatus(`${t.errorPrefix}: ${seedError.message}`);
              }
            }
          }
        } else {
          setMinifigPartCheckedByRowId(
            expandedRows.reduce(
              (acc: Record<string, boolean>, row) => {
                acc[row.row_id] = true;
                return acc;
              },
              {},
            ),
          );
          setMinifigSetHasMissingPartsBySetNum((prev) => ({
            ...prev,
            [figure.set_num]: false,
          }));
          setMinifigMissingPartsPreviewBySetNum((prev) => ({
            ...prev,
            [figure.set_num]: [],
          }));
        }

        setMinifigPartsLoading(false);
      } catch (error) {
        setStatus(`${t.errorPrefix}: ${(error as Error).message}`);
        setMinifigPartsRows([]);
        setMinifigPartCheckedByRowId({});
        setMinifigPartsLoading(false);
      }
    },
    [getSupabaseAuthHeaders, supabase, t.errorPrefix, userId],
  );

  const syncAutoMinifigMissingWishlist = useCallback(async (setNumsForSync?: string[]) => {
    if (!supabase || !userId) {
      return;
    }

    setMinifigMissingWishlistSyncing(true);

    try {
      const aggregate = new Map<string, { part_num: string; part_name: string; color_name: string; quantity: number }>();

      let targetSetNums = Array.from(new Set((setNumsForSync ?? []).map((setNum) => String(setNum).trim()).filter(Boolean)));
      if (targetSetNums.length === 0) {
        const [{ data: ownedSetRows, error: ownedSetError }, { data: partSetRows, error: partSetError }] = await Promise.all([
          supabase.from("minifig_user_inventory").select("set_num").eq("user_id", userId).eq("is_owned", true),
          supabase.from("minifig_user_part_inventory").select("set_num").eq("user_id", userId),
        ]);

        if (ownedSetError) {
          setStatus(`${t.errorPrefix}: ${ownedSetError.message}`);
          setMinifigMissingWishlistSyncing(false);
          return;
        }

        if (partSetError) {
          setStatus(`${t.errorPrefix}: ${partSetError.message}`);
          setMinifigMissingWishlistSyncing(false);
          return;
        }

        targetSetNums = Array.from(
          new Set(
            [...(ownedSetRows ?? []), ...(partSetRows ?? [])]
              .map((row) => String((row as { set_num?: unknown }).set_num ?? "").trim())
              .filter(Boolean),
          ),
        );
      }

      const missingAnalysis = await loadMinifigMissingAnalysisBySetNums(targetSetNums);
      if (missingAnalysis.hadError) {
        setMinifigMissingWishlistSyncing(false);
        return;
      }

      for (const row of missingAnalysis.missingRows) {
        const aggregateKey = `${row.part_num}::${row.color_name}`;
        const current = aggregate.get(aggregateKey);
        if (current) {
          current.quantity += row.missing_quantity;
        } else {
          aggregate.set(aggregateKey, {
            part_num: row.part_num,
            part_name: row.part_name || row.part_num,
            color_name: row.color_name,
            quantity: row.missing_quantity,
          });
        }
      }

      const missingRows = Array.from(aggregate.values()).filter((row) => row.quantity > 0);
      const { data: existingList } = await supabase
        .from("lists")
        .select("list_id")
        .eq("owner_id", userId)
        .eq("list_type", "deseos")
        .eq("name", AUTO_MINIFIG_MISSING_LIST_NAME)
        .maybeSingle();

      if (missingRows.length === 0) {
        if (existingList?.list_id) {
          await supabase.from("lists").delete().eq("list_id", String(existingList.list_id)).eq("owner_id", userId);
          await loadListasFromDb();
        }
        setMinifigMissingWishlistSyncing(false);
        return;
      }

      let listId = String(existingList?.list_id ?? "").trim();
      if (!listId) {
        const { data: createdList, error: createListError } = await supabase
          .from("lists")
          .insert({
            owner_id: userId,
            lug_id: currentLugId,
            name: AUTO_MINIFIG_MISSING_LIST_NAME,
            list_type: "deseos",
            is_public: false,
          })
          .select("list_id")
          .single();

        if (createListError || !createdList?.list_id) {
          setStatus(`${t.errorPrefix}: ${createListError?.message || "No se pudo crear la lista"}`);
          setMinifigMissingWishlistSyncing(false);
          return;
        }

        listId = String(createdList.list_id);
      }

      await supabase.from("list_items").delete().eq("list_id", listId);

      const payloadItems = missingRows.map((row) => ({
        list_id: listId,
        part_num: row.part_num,
        part_name: row.part_name,
        color_name: row.color_name ? `BrickLink: ${row.color_name}` : null,
        imgmatchcolor: true,
        quantity: row.quantity,
      }));

      const { error: insertError } = await supabase.from("list_items").insert(payloadItems);
      if (insertError) {
        setStatus(`${t.errorPrefix}: ${insertError.message}`);
        setMinifigMissingWishlistSyncing(false);
        return;
      }

      await loadListasFromDb();
    } catch (error) {
      setStatus(`${t.errorPrefix}: ${(error as Error).message}`);
    }

    setMinifigMissingWishlistSyncing(false);
  }, [currentLugId, loadListasFromDb, loadMinifigMissingAnalysisBySetNums, supabase, t.errorPrefix, userId]);

  const openMinifigurasSection = useCallback(async (options?: { navigate?: boolean }) => {
    if (options?.navigate !== false) {
      navigateSectionClient("minifiguras", "/minifiguras");
    } else {
      setActiveSection("minifiguras");
    }
    const shouldRefreshSeries = minifigSeriesRows.length === 0 || Date.now() - minifigSeriesLastLoadedAtRef.current > SECTION_DATA_CACHE_MS;
    if (shouldRefreshSeries) {
      await loadCollectibleSeries();
    }
  }, [loadCollectibleSeries, minifigSeriesRows.length, navigateSectionClient]);

  const loadListItems = useCallback(
    async (listId: string) => {
      if (!supabase || !userId) {
        return;
      }

      setListItemsLoading(true);

      const listItemsWithValueAndImage = await supabase
        .from("list_items")
        .select("item_id, part_num, part_name, color_name, imgmatchcolor, part_img_url, quantity, value")
        .eq("list_id", listId)
        .order("created_at", { ascending: false });

      const listItemsWithValue = listItemsWithValueAndImage.error
        ? await supabase
            .from("list_items")
            .select("item_id, part_num, part_name, color_name, imgmatchcolor, quantity, value")
            .eq("list_id", listId)
            .order("created_at", { ascending: false })
        : listItemsWithValueAndImage;

      const listItemsResult = listItemsWithValue.error
        ? await supabase
            .from("list_items")
            .select("item_id, part_num, part_name, color_name, imgmatchcolor, quantity")
            .eq("list_id", listId)
            .order("created_at", { ascending: false })
        : listItemsWithValue;

      const data = listItemsResult.data;
      const error = listItemsResult.error;

      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
        setListItemsLoading(false);
        return;
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const parsedRows = rows.map((row) => ({
        item_id: String(row.item_id ?? ""),
        part_num: row.part_num ? String(row.part_num) : null,
        part_name: row.part_name ? String(row.part_name) : null,
        color_name: row.color_name ? String(row.color_name) : null,
        imgmatchcolor: Boolean(row.imgmatchcolor),
        display_color_label: parseStoredColorLabel(row.color_name ? String(row.color_name) : null),
        part_img_url: row.part_img_url ? String(row.part_img_url) : null,
        quantity: Number(row.quantity ?? 1),
        value: (() => {
          if (row.value == null) {
            return null;
          }
          const parsed = Number(row.value);
          return Number.isFinite(parsed) ? parsed : null;
        })(),
      }));

      const partNums = Array.from(new Set(parsedRows.map((item) => item.part_num).filter((item): item is string => Boolean(item))));
      const catalogImageByPartNum = new Map<string, string | null>();
      const colorRowsByPartNum = new Map<string, Array<{ color_name: string; part_img_url: string | null }>>();

      if (partNums.length > 0) {
        const [{ data: partsData }, { data: colorData }] = await Promise.all([
          supabase.from("parts_catalog").select("part_num, part_img_url").in("part_num", partNums),
          supabase.from("part_color_catalog").select("part_num, color_name, part_img_url").in("part_num", partNums),
        ]);

        (partsData ?? []).forEach((row) => {
          const key = String(row.part_num ?? "");
          if (!key) {
            return;
          }
          catalogImageByPartNum.set(key, row.part_img_url ? String(row.part_img_url) : null);
        });

        (colorData ?? []).forEach((row) => {
          const key = String(row.part_num ?? "");
          const colorName = String(row.color_name ?? "").trim();
          if (!key || !colorName) {
            return;
          }

          if (!colorRowsByPartNum.has(key)) {
            colorRowsByPartNum.set(key, []);
          }

          colorRowsByPartNum.get(key)?.push({
            color_name: colorName,
            part_img_url: row.part_img_url ? String(row.part_img_url) : null,
          });
        });
      }

      const enrichedRows = parsedRows.map((item) => {
        const partNum = item.part_num;
        const colorLabel = item.display_color_label;
        const colorRows = partNum ? (colorRowsByPartNum.get(partNum) ?? []) : [];
        let colorImageUrl: string | null = null;

        if (colorLabel) {
          const target = normalizeColorLabel(colorLabel);
          const exact = colorRows.find((row) => normalizeColorLabel(row.color_name) === target);
          if (exact?.part_img_url) {
            colorImageUrl = exact.part_img_url;
          } else {
            const partial = colorRows.find((row) => {
              const current = normalizeColorLabel(row.color_name);
              return current.includes(target) || target.includes(current);
            });
            colorImageUrl = partial?.part_img_url ?? null;
          }
        }

        const baseImage = partNum ? (catalogImageByPartNum.get(partNum) ?? null) : null;
        const persistedImage = item.part_img_url;

        return {
          ...item,
          part_img_url: persistedImage || colorImageUrl || baseImage,
          imgmatchcolor: colorLabel ? Boolean(persistedImage || colorImageUrl) : item.imgmatchcolor,
        };
      });

      setListItemsRows(enrichedRows);
      setItemQuantityInputs(
        parsedRows.reduce(
          (acc: Record<string, string>, item) => {
            acc[item.item_id] = String(Math.max(1, Number(item.quantity) || 1));
            return acc;
          },
          {},
        ),
      );
      setItemPriceInputs(
        parsedRows.reduce(
          (acc: Record<string, string>, item) => {
            if (item.value == null || !Number.isFinite(item.value)) {
              acc[item.item_id] = "";
            } else {
              acc[item.item_id] = String(item.value);
            }
            return acc;
          },
          {},
        ),
      );

      const itemIds = parsedRows.map((item) => item.item_id).filter(Boolean);
      if (itemIds.length > 0) {
        const { data: offersData } = await supabase
          .from("wishlist_item_offers")
          .select("offer_id, list_item_id, requester_id, quantity")
          .in("list_item_id", itemIds);

        const requesterIds = Array.from(new Set((offersData ?? []).map((row) => String((row as { requester_id?: unknown }).requester_id ?? "")).filter(Boolean)));
        const requesterNameById = await fetchProfileNamesByIds(requesterIds);
        const lugMemberNameById = await fetchCurrentLugMemberNamesByIds(requesterIds);

        const offersMap: Record<string, WishlistOfferDetail[]> = {};
        (offersData ?? []).forEach((row) => {
          const listItemId = String((row as { list_item_id?: unknown }).list_item_id ?? "");
          if (!listItemId) {
            return;
          }
          if (!offersMap[listItemId]) {
            offersMap[listItemId] = [];
          }
          const requesterId = String((row as { requester_id?: unknown }).requester_id ?? "");
          const fallbackRequesterName = requesterId ? `ID ${requesterId.slice(0, 8)}` : labels.noNameFallback;
          offersMap[listItemId].push({
            offer_id: String((row as { offer_id?: unknown }).offer_id ?? ""),
            list_item_id: listItemId,
            requester_id: requesterId,
            requester_name: requesterNameById.get(requesterId) || lugMemberNameById.get(requesterId) || fallbackRequesterName,
            quantity: Math.max(1, Number((row as { quantity?: unknown }).quantity ?? 1) || 1),
          });
        });

        setListItemOffersById(offersMap);
      } else {
        setListItemOffersById({});
      }

      setListItemsLoading(false);
    },
    [fetchCurrentLugMemberNamesByIds, fetchProfileNamesByIds, labels.noNameFallback, supabase, t.errorPrefix, userId],
  );

  const loadMiLugPools = useCallback(async () => {
    if (!supabase || !currentLugId) {
      return;
    }

    setMiLugPoolsLoading(true);

    const { data: membersData, error: membersError } = await supabase.rpc("get_lug_members_current", {
      target_lug_id: currentLugId,
    });

    if (membersError) {
      setStatus(`${t.errorPrefix}: ${membersError.message}`);
      setMiLugPoolsLoading(false);
      return;
    }

    const memberIds = Array.from(
      new Set(((membersData ?? []) as Array<{ id?: unknown }>).map((member) => String(member.id ?? "").trim()).filter(Boolean)),
    );

    if (memberIds.length === 0) {
      setMiLugPoolWishlistItems([]);
      setMiLugPoolSaleItems([]);
      setMiLugPoolsLoading(false);
      return;
    }

    const { data: listsData, error: listsError } = await supabase
      .from("lists")
      .select("list_id, owner_id, list_type")
      .in("owner_id", memberIds)
      .eq("is_public", true);

    if (listsError) {
      setStatus(`${t.errorPrefix}: ${listsError.message}`);
      setMiLugPoolsLoading(false);
      return;
    }

    const publicLists: Array<{ list_id: string; owner_id: string; list_type: "deseos" | "venta" }> = (listsData ?? []).map((row) => ({
      list_id: String(row.list_id ?? ""),
      owner_id: String(row.owner_id ?? ""),
      list_type: row.list_type === "venta" ? "venta" : "deseos",
    }));

    if (publicLists.length === 0) {
      setMiLugPoolWishlistItems([]);
      setMiLugPoolSaleItems([]);
      setMiLugPoolsLoading(false);
      return;
    }

    const listIds = publicLists.map((item) => item.list_id);
    const ownerIds = Array.from(new Set(publicLists.map((item) => item.owner_id).filter(Boolean)));

    const listItemsWithValueAndImage = await supabase
      .from("list_items")
      .select("item_id, list_id, part_num, part_name, color_name, imgmatchcolor, part_img_url, quantity, value")
      .in("list_id", listIds)
      .order("created_at", { ascending: false })
      .limit(500);

    const listItemsWithValue = listItemsWithValueAndImage.error
      ? await supabase
          .from("list_items")
          .select("item_id, list_id, part_num, part_name, color_name, imgmatchcolor, quantity, value")
          .in("list_id", listIds)
          .order("created_at", { ascending: false })
          .limit(500)
      : listItemsWithValueAndImage;

    const listItemsResult = listItemsWithValue.error
      ? await supabase
          .from("list_items")
          .select("item_id, list_id, part_num, part_name, color_name, imgmatchcolor, quantity")
          .in("list_id", listIds)
          .order("created_at", { ascending: false })
          .limit(500)
      : listItemsWithValue;

    const listItemsData = listItemsResult.data;
    const listItemsError = listItemsResult.error;

    if (listItemsError) {
      setStatus(`${t.errorPrefix}: ${listItemsError.message}`);
      setMiLugPoolsLoading(false);
      return;
    }

    const rows = listItemsData ?? [];
    const rowItemIds = rows.map((row) => String((row as { item_id?: unknown }).item_id ?? "")).filter(Boolean);
    const uniquePartNums = Array.from(new Set(rows.map((row) => String((row as { part_num?: unknown }).part_num ?? "").trim()).filter(Boolean)));

    const [{ data: partsData }, { data: colorRowsData }, { data: offersData }] = await Promise.all([
      uniquePartNums.length > 0
        ? supabase.from("parts_catalog").select("part_num, part_img_url").in("part_num", uniquePartNums)
        : Promise.resolve({ data: [] as never[] }),
      uniquePartNums.length > 0
        ? supabase.from("part_color_catalog").select("part_num, color_name, part_img_url").in("part_num", uniquePartNums)
        : Promise.resolve({ data: [] as never[] }),
      rowItemIds.length > 0
        ? supabase.from("wishlist_item_offers").select("list_item_id, requester_id, quantity").in("list_item_id", rowItemIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const listMetaById = new Map(publicLists.map((item) => [item.list_id, item]));
    const lugMemberNameById = new Map(
      ((membersData ?? []) as Array<Record<string, unknown>>)
        .map((member) => [String(member.id ?? "").trim(), String(member.full_name ?? "").trim()] as const)
        .filter(([id, fullName]) => id && fullName),
    );
    const partImageByNum = new Map(
      (partsData ?? []).map((row) => [String((row as { part_num?: unknown }).part_num ?? ""), (row as { part_img_url?: unknown }).part_img_url ? String((row as { part_img_url?: unknown }).part_img_url) : null]),
    );
    const colorRowsByPartNum = new Map<string, Array<{ color_name: string; part_img_url: string | null }>>();
    (colorRowsData ?? []).forEach((row) => {
      const partNum = String((row as { part_num?: unknown }).part_num ?? "").trim();
      const colorName = String((row as { color_name?: unknown }).color_name ?? "").trim();
      if (!partNum || !colorName) {
        return;
      }
      if (!colorRowsByPartNum.has(partNum)) {
        colorRowsByPartNum.set(partNum, []);
      }
      colorRowsByPartNum.get(partNum)?.push({
        color_name: colorName,
        part_img_url: (row as { part_img_url?: unknown }).part_img_url ? String((row as { part_img_url?: unknown }).part_img_url) : null,
      });
    });
    const offersByItemId = new Map<string, Array<{ requester_id: string; quantity: number }>>();
    (offersData ?? []).forEach((row) => {
      const itemId = String((row as { list_item_id?: unknown }).list_item_id ?? "");
      if (!itemId) {
        return;
      }
      if (!offersByItemId.has(itemId)) {
        offersByItemId.set(itemId, []);
      }
      offersByItemId.get(itemId)?.push({
        requester_id: String((row as { requester_id?: unknown }).requester_id ?? ""),
        quantity: Math.max(1, Number((row as { quantity?: unknown }).quantity ?? 1) || 1),
      });
    });

    const requesterIdsInOffers = Array.from(
      new Set((offersData ?? []).map((row) => String((row as { requester_id?: unknown }).requester_id ?? "")).filter(Boolean)),
    );
    const namesById = await fetchProfileNamesByIds([...ownerIds, ...requesterIdsInOffers]);

    const wishlist: MiLugPoolItem[] = [];
    const sale: MiLugPoolItem[] = [];

    for (const row of rows) {
      const listId = String((row as { list_id?: unknown }).list_id ?? "");
      const listMeta = listMetaById.get(listId);
      if (!listMeta) {
        continue;
      }

      const partNum = String((row as { part_num?: unknown }).part_num ?? "").trim();
      if (!partNum) {
        continue;
      }

      const partName = String((row as { part_name?: unknown }).part_name ?? partNum).trim();
      const rawColorName = String((row as { color_name?: unknown }).color_name ?? "").trim() || null;
      const displayColor = parseStoredColorLabel(rawColorName);
      const imgMatchColor = Boolean((row as { imgmatchcolor?: unknown }).imgmatchcolor ?? true);
      const publisherName = namesById.get(listMeta.owner_id) || lugMemberNameById.get(listMeta.owner_id) || (listMeta.owner_id ? `ID ${listMeta.owner_id.slice(0, 8)}` : labels.noNameFallback);
      const itemId = String((row as { item_id?: unknown }).item_id ?? `${listId}-${partNum}`);
      const baseQuantity = Math.max(1, Number((row as { quantity?: unknown }).quantity ?? 1) || 1);
      const offers = offersByItemId.get(itemId) ?? [];
      const totalOffered = offers.reduce((acc, offer) => acc + Math.max(1, offer.quantity), 0);
      const currentUserOfferQuantity = offers
        .filter((offer) => offer.requester_id === userId)
        .reduce((acc, offer) => acc + Math.max(1, offer.quantity), 0);
      const remainingQuantity = Math.max(0, baseQuantity - totalOffered);

      const displayQuantity = listMeta.list_type === "deseos" ? remainingQuantity : baseQuantity;

      if (listMeta.list_type === "deseos" && listMeta.owner_id !== userId && remainingQuantity <= 0 && currentUserOfferQuantity <= 0) {
        continue;
      }

      const baseImage = partImageByNum.get(partNum) ?? null;
      const persistedImage = (row as { part_img_url?: unknown }).part_img_url ? String((row as { part_img_url?: unknown }).part_img_url) : null;
      let colorImage: string | null = null;
      if (displayColor) {
        const target = normalizeColorLabel(displayColor);
        const colorRows = colorRowsByPartNum.get(partNum) ?? [];
        const exact = colorRows.find((colorRow) => normalizeColorLabel(colorRow.color_name) === target);
        if (exact?.part_img_url) {
          colorImage = exact.part_img_url;
        } else {
          const partial = colorRows.find((colorRow) => {
            const current = normalizeColorLabel(colorRow.color_name);
            return current.includes(target) || target.includes(current);
          });
          colorImage = partial?.part_img_url ?? null;
        }
      }

      const item: MiLugPoolItem = {
        id: itemId,
        part_num: partNum,
        part_name: partName,
        part_img_url: persistedImage || colorImage || baseImage,
        color_label: displayColor,
        list_type: listMeta.list_type,
        publisher_id: listMeta.owner_id,
        quantity: displayQuantity,
        requested_quantity: baseQuantity,
        remaining_quantity: remainingQuantity,
        current_user_offer_quantity: currentUserOfferQuantity,
        value: (row as { value?: unknown }).value == null ? null : Number((row as { value?: unknown }).value),
        publisher_name: publisherName,
        imgmatchcolor: displayColor ? Boolean(persistedImage || colorImage) : imgMatchColor,
      };

      if (listMeta.list_type === "venta") {
        sale.push(item);
      } else {
        wishlist.push(item);
      }
    }

    setMiLugPoolWishlistItems(wishlist);
    setMiLugPoolSaleItems(sale);
    setMiLugWishlistPage(1);
    setMiLugSalePage(1);
    setMiLugPoolsLoading(false);
  }, [currentLugId, fetchProfileNamesByIds, labels.noNameFallback, supabase, t.errorPrefix, userId]);

  const loadOffersGivenSummary = useCallback(async () => {
    if (!supabase || !userId) {
      return;
    }

    setOffersPanelsLoading(true);

    const { data: offersData, error: offersError } = await supabase
      .from("wishlist_item_offers")
      .select("offer_id, list_item_id, quantity")
      .eq("requester_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (offersError) {
      setStatus(`${t.errorPrefix}: ${offersError.message}`);
      setOffersPanelsLoading(false);
      return;
    }

    const itemIds = Array.from(new Set((offersData ?? []).map((row) => String((row as { list_item_id?: unknown }).list_item_id ?? "")).filter(Boolean)));
    if (itemIds.length === 0) {
      setOffersGivenRows([]);
      setOffersPanelsLoading(false);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase.from("list_items").select("item_id, list_id, part_num, part_name").in("item_id", itemIds);
    if (itemsError) {
      setStatus(`${t.errorPrefix}: ${itemsError.message}`);
      setOffersPanelsLoading(false);
      return;
    }

    const listIds = Array.from(new Set((itemsData ?? []).map((row) => String((row as { list_id?: unknown }).list_id ?? "")).filter(Boolean)));
    if (listIds.length === 0) {
      setOffersGivenRows([]);
      setOffersPanelsLoading(false);
      return;
    }

    const { data: listsData, error: listsError } = await supabase.from("lists").select("list_id, owner_id").in("list_id", listIds);
    if (listsError) {
      setStatus(`${t.errorPrefix}: ${listsError.message}`);
      setOffersPanelsLoading(false);
      return;
    }

    const listOwnerByListId = new Map(
      (listsData ?? []).map((row) => [String((row as { list_id?: unknown }).list_id ?? ""), String((row as { owner_id?: unknown }).owner_id ?? "")]),
    );
    const itemListByItemId = new Map(
      (itemsData ?? []).map((row) => [String((row as { item_id?: unknown }).item_id ?? ""), String((row as { list_id?: unknown }).list_id ?? "")]),
    );
    const itemLabelByItemId = new Map(
      (itemsData ?? []).map((row) => {
        const itemId = String((row as { item_id?: unknown }).item_id ?? "");
        const partNum = String((row as { part_num?: unknown }).part_num ?? "");
        const partName = String((row as { part_name?: unknown }).part_name ?? "");
        return [itemId, `${partNum || "-"} - ${partName || "Pieza"}`];
      }),
    );

    const ownerIds = Array.from(new Set(Array.from(listOwnerByListId.values()).filter(Boolean)));
    const ownerNamesById = await fetchProfileNamesByIds(ownerIds);
    const memberNamesById = await fetchCurrentLugMemberNamesByIds(ownerIds);

    const rows: OfferSummaryRow[] = (offersData ?? []).map((row) => {
      const itemId = String((row as { list_item_id?: unknown }).list_item_id ?? "");
      const listId = itemListByItemId.get(itemId) ?? "";
      const ownerId = listOwnerByListId.get(listId) ?? "";
      const quantity = Math.max(1, Number((row as { quantity?: unknown }).quantity ?? 1) || 1);
      const userName = ownerNamesById.get(ownerId) || memberNamesById.get(ownerId) || (ownerId ? `ID ${ownerId.slice(0, 8)}` : labels.noNameFallback);
      const partLabel = itemLabelByItemId.get(itemId) || "- - Pieza";

      return {
        id: String((row as { offer_id?: unknown }).offer_id ?? itemId),
        userName,
        partLabel,
        quantity,
      };
    });

    rows.sort((a, b) => {
      const byUser = a.userName.localeCompare(b.userName, "es", { sensitivity: "base" });
      if (byUser !== 0) return byUser;
      return a.partLabel.localeCompare(b.partLabel, "es", { sensitivity: "base" });
    });
    setOffersGivenRows(rows);
    setOffersPanelsLoading(false);
  }, [fetchCurrentLugMemberNamesByIds, fetchProfileNamesByIds, labels.noNameFallback, supabase, t.errorPrefix, userId]);

  const loadOffersReceivedSummary = useCallback(async () => {
    if (!supabase || !userId) {
      return;
    }

    setOffersPanelsLoading(true);

    const { data: myWishlists } = await supabase
      .from("lists")
      .select("list_id")
      .eq("owner_id", userId)
      .eq("list_type", "deseos");

    const myListIds = (myWishlists ?? []).map((row) => String((row as { list_id?: unknown }).list_id ?? "")).filter(Boolean);
    if (myListIds.length === 0) {
      setOffersReceivedRows([]);
      setOffersPanelsLoading(false);
      return;
    }

    const { data: myItems } = await supabase
      .from("list_items")
      .select("item_id, part_num, part_name")
      .in("list_id", myListIds);

    const myItemIds = (myItems ?? []).map((row) => String((row as { item_id?: unknown }).item_id ?? "")).filter(Boolean);
    if (myItemIds.length === 0) {
      setOffersReceivedRows([]);
      setOffersPanelsLoading(false);
      return;
    }

    const { data: offersData, error: offersError } = await supabase
      .from("wishlist_item_offers")
      .select("offer_id, list_item_id, requester_id, quantity")
      .in("list_item_id", myItemIds)
      .order("created_at", { ascending: false })
      .limit(500);

    if (offersError) {
      setStatus(`${t.errorPrefix}: ${offersError.message}`);
      setOffersPanelsLoading(false);
      return;
    }

    const itemLabelById = new Map(
      (myItems ?? []).map((row) => {
        const itemId = String((row as { item_id?: unknown }).item_id ?? "");
        const partNum = String((row as { part_num?: unknown }).part_num ?? "");
        const partName = String((row as { part_name?: unknown }).part_name ?? "");
        return [itemId, `${partNum || "-"} - ${partName || "Pieza"}`];
      }),
    );

    const requesterIds = Array.from(
      new Set((offersData ?? []).map((row) => String((row as { requester_id?: unknown }).requester_id ?? "")).filter(Boolean)),
    );
    const requesterNamesById = await fetchProfileNamesByIds(requesterIds);
    const memberNamesById = await fetchCurrentLugMemberNamesByIds(requesterIds);

    const rows: OfferSummaryRow[] = (offersData ?? []).map((row) => {
      const requesterId = String((row as { requester_id?: unknown }).requester_id ?? "");
      const itemId = String((row as { list_item_id?: unknown }).list_item_id ?? "");
      const quantity = Math.max(1, Number((row as { quantity?: unknown }).quantity ?? 1) || 1);
      const userName = requesterNamesById.get(requesterId) || memberNamesById.get(requesterId) || (requesterId ? `ID ${requesterId.slice(0, 8)}` : labels.noNameFallback);
      const partLabel = itemLabelById.get(itemId) || "- - Pieza";

      return {
        id: String((row as { offer_id?: unknown }).offer_id ?? itemId),
        userName,
        partLabel,
        quantity,
      };
    });

    rows.sort((a, b) => {
      const byUser = a.userName.localeCompare(b.userName, "es", { sensitivity: "base" });
      if (byUser !== 0) return byUser;
      return a.partLabel.localeCompare(b.partLabel, "es", { sensitivity: "base" });
    });
    setOffersReceivedRows(rows);
    setOffersPanelsLoading(false);
  }, [fetchCurrentLugMemberNamesByIds, fetchProfileNamesByIds, labels.noNameFallback, supabase, t.errorPrefix, userId]);

  function printOffersSummary(title: string, rows: OfferSummaryRow[]) {
    if (rows.length === 0) {
      setStatus(statusText.noDataToExport);
      return;
    }

    const exportDateTime = new Date().toLocaleString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const exportUserLabel = displayName || labels.noNameFallback;
    const exportEmailLabel = userEmail || labels.noMail;

    const rowsHtml = rows
      .map((row) => {
        return `<tr><td>${escapeHtml(row.userName)}</td><td>${escapeHtml(row.partLabel)}</td><td>${Math.max(1, Number(row.quantity || 1))}</td></tr>`;
      })
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>
body{font-family:Arial,sans-serif;padding:24px;color:#111}
h1{margin:0 0 16px 0;font-size:22px}
.meta{margin:0 0 16px 0;font-size:12px;line-height:1.5}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #d1d5db;padding:8px;font-size:12px;text-align:left;vertical-align:middle}
th{background:#f3f4f6}
</style></head><body>
<p class="meta"><strong>${escapeHtml(labels.exportUser)}:</strong> ${escapeHtml(exportUserLabel)}<br/><strong>${escapeHtml(labels.exportMail)}:</strong> ${escapeHtml(exportEmailLabel)}<br/><strong>${escapeHtml(labels.exportDate)}:</strong> ${escapeHtml(exportDateTime)}</p>
<h1>${escapeHtml(title)}</h1>
<table><thead><tr><th>${escapeHtml(labels.exportUser)}</th><th>${escapeHtml(labels.exportPiece)}</th><th>${escapeHtml(labels.exportQuantity)}</th></tr></thead><tbody>${rowsHtml}</tbody></table>
</body></html>`;

    const popup = window.open("", "_blank", "width=960,height=720");
    if (!popup) {
      setStatus(statusText.printWindowFailed);
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  async function openOffersGivenPanel() {
    setShowOffersGivenPanel(true);
    await loadOffersGivenSummary();
  }

  async function openOffersReceivedPanel() {
    setShowOffersReceivedPanel(true);
    await loadOffersReceivedSummary();
  }

  const loadGoBrickColors = useCallback(async () => {
    const response = await fetch("/api/gobrick-colors");
    const json = (await response.json()) as {
      error?: string;
      colors?: GoBrickColorItem[];
    };

    if (!response.ok) {
      setStatus(json.error || "No pudimos cargar los colores.");
      return;
    }

    const parsedColors = Array.isArray(json.colors) ? json.colors : [];
    setGoBrickColors(parsedColors);

    setAddItemColorNameInput(NO_COLOR_LABEL);
  }, []);

  const openListDetailPage = useCallback(
    async (lista: ListaItem, options?: { navigate?: boolean }) => {
      if (options?.navigate !== false) {
        router.push(`/listas/${lista.id}`);
      }
      setSelectedListForItems(lista);
      setActiveSection("lista_detalle");
      setPartsSearchQuery("");
      setShowCategoriesPanel(false);
      setCategoriesPanelMode("categories");
      setSelectedPanelCategory(null);
      setPanelPartsPage(1);
      setPanelPartsResults([]);
      setPanelPrintFilters({ no_printed: true, printed: false });
      setSelectedPanelPartNum(null);
      setSelectedSearchPartNum(null);
      setPartsSearchResults([]);
      setPartsSearchQuery("");
      setPartsSearchLoading(false);
      setShowPartSearchDropdown(false);
      setAddItemColorNameInput(NO_COLOR_LABEL);
      setAddItemColorMode("bricklink");
      setShowColorDropdown(false);
      setAddItemColorExists(true);
      setPartAvailableColorNames([]);
      setSelectedPartColorImageUrl(null);
      setSelectedPartColorImageMissing(false);
      setAddItemQuantity(1);
      setAddItemPriceInput("");
      if (partsCategories.length === 0) {
        await loadPartsCategories();
      }
      if (goBrickColors.length === 0) {
        await loadGoBrickColors();
      }
      await loadListItems(lista.id);
    },
    [goBrickColors.length, loadGoBrickColors, loadListItems, loadPartsCategories, partsCategories.length, router],
  );

  const openListDetailById = useCallback(
    async (listId: string, ownerIdOverride?: string | null) => {
      const ownerId = ownerIdOverride ?? userId;
      if (!supabase || !ownerId) {
        return;
      }

      let { data, error } = await supabase
        .from("lists")
        .select("list_id, name, list_type, is_public")
        .eq("list_id", listId)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (!data) {
        const fallback = listasItems.find((item) => item.id === listId);
        if (fallback) {
          await openListDetailPage(fallback, { navigate: false });
          return;
        }
      }

      if (!data) {
        const retry = await supabase.from("lists").select("list_id, name, list_type, is_public").eq("list_id", listId).maybeSingle();
        data = retry.data;
        error = retry.error;
      }

      if (error || !data) {
        if (!data && listasItems.length === 0) {
          return;
        }
        setStatus(statusText.listOpenFailed);
        return;
      }

      const lista: ListaItem = {
        id: String(data.list_id ?? ""),
        nombre: String(data.name ?? ""),
        tipo: data.list_type === "venta" ? "venta" : "deseos",
        piezas: 0,
        lotes: 0,
        visibilidad: data.is_public ? "publico" : "privado",
      };

      await openListDetailPage(lista, { navigate: false });
    },
    [listasItems, openListDetailPage, statusText.listOpenFailed, supabase, userId],
  );

  function handleAddItemColorMode(mode: "bricklink" | "lego") {
    setAddItemColorMode(mode);
    setShowColorDropdown(false);
    setPartAvailableColorNames([]);
    setSelectedPartColorImageUrl(null);
    setSelectedPartColorImageMissing(false);

    const available = goBrickColors
      .map((color) => (mode === "lego" ? color.lego : color.bricklink))
      .filter((value): value is string => Boolean(value));

    if (addItemColorNameInput === NO_COLOR_LABEL) {
      return;
    }

    if (available.length === 0) {
      setAddItemColorNameInput(NO_COLOR_LABEL);
      return;
    }

    if (!available.includes(addItemColorNameInput)) {
      setAddItemColorNameInput(available[0]);
    }
  }

  function openRenameListaPanel(item: ListaItem) {
    setListaToRename(item);
    setRenameListaInput(item.nombre);
    setShowRenameListaPanel(true);
  }

  async function saveRenameLista() {
    if (!supabase || !userId || !listaToRename) {
      return;
    }

    const nextName = renameListaInput.trim();
    if (!nextName) {
      setStatus(statusText.listNameRequired);
      return;
    }

    setListasSaving(true);

    const { error } = await supabase
      .from("lists")
      .update({ name: nextName })
      .eq("list_id", listaToRename.id)
      .eq("owner_id", userId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setListasSaving(false);
      return;
    }

    setListasItems((prev) => prev.map((item) => (item.id === listaToRename.id ? { ...item, nombre: nextName } : item)));
    setSelectedListForItems((prev) => (prev && prev.id === listaToRename.id ? { ...prev, nombre: nextName } : prev));
    setShowRenameListaPanel(false);
    setListaToRename(null);
    setRenameListaInput("");
    setListasSaving(false);
  }

  async function loadPanelCategoryParts(category: PartCategoryItem, query = "") {
    setPanelPartsLoading(true);
    setSelectedPanelPartNum(null);

    const queryText = query.trim();
    const pageSize = 100;
    const maxFetchPages = 60;
    const allResults: PartCatalogItem[] = [];
    let totalCount = 0;

    for (let page = 1; page <= maxFetchPages; page += 1) {
      const params = new URLSearchParams({
        category_id: String(category.id),
        page: String(page),
        page_size: String(pageSize),
        local_only: "1",
      });

      if (queryText) {
        params.set("q", queryText);
      }

      const authHeaders = await getSupabaseAuthHeaders();
      const response = await fetch(`/api/rebrickable/parts?${params.toString()}`, {
        headers: authHeaders,
      });
      const json = (await response.json()) as {
        error?: string;
        count?: number;
        results?: PartCatalogItem[];
      };

      if (!response.ok) {
        setStatus(json.error || "No pudimos cargar piezas de Rebrickable.");
        setPanelPartsLoading(false);
        return;
      }

      const chunk = Array.isArray(json.results) ? json.results : [];
      allResults.push(...chunk);
      totalCount = Number(json.count ?? allResults.length);

      if (chunk.length === 0 || allResults.length >= totalCount) {
        break;
      }
    }

    setPanelPartsResults(allResults);
    setPanelPartsPage(1);
    setPanelPartsLoading(false);
  }

  async function addPartToList(
    part: PartCatalogItem,
    options?: {
      colorName?: string | null;
      quantity?: number;
      colorMode?: "bricklink" | "lego";
      imgMatchColor?: boolean;
      value?: number | null;
    },
  ) {
    if (!supabase || !selectedListForItems || !userId) {
      return;
    }

    const quantity = Math.max(1, Number(options?.quantity ?? 1));
    const cleanColor = String(options?.colorName ?? "").trim();
    const colorMode = options?.colorMode ?? "bricklink";
    const colorName = cleanColor && cleanColor !== NO_COLOR_LABEL ? `${colorMode === "lego" ? "LEGO" : "BrickLink"}: ${cleanColor}` : null;
    const hasSelectedColor = Boolean(cleanColor && cleanColor !== NO_COLOR_LABEL);
    const imgMatchColor = hasSelectedColor ? Boolean(options?.imgMatchColor ?? false) : true;
    const value = options?.value == null ? null : Number(options.value);
    let resolvedPartImageUrl = part.part_img_url || null;

    let finalImgMatchColor = imgMatchColor;
    if (hasSelectedColor) {
      try {
        const params = new URLSearchParams({
          part_num: part.part_num,
          color_name: cleanColor,
          mode: colorMode,
        });
        const response = await fetch(`/api/rebrickable/part-color-image?${params.toString()}`);
        const payload = (await response.json()) as { image_url?: string | null };
        if (response.ok && payload.image_url) {
          resolvedPartImageUrl = String(payload.image_url);
          finalImgMatchColor = true;
        } else {
          finalImgMatchColor = false;
        }
      } catch {}
    }

    setListasSaving(true);

    const insertPayload: {
      list_id: string;
      part_num: string;
      part_name: string;
      color_name: string | null;
      imgmatchcolor: boolean;
      part_img_url: string | null;
      quantity: number;
      value?: number;
    } = {
      list_id: selectedListForItems.id,
      part_num: part.part_num,
      part_name: part.name,
      color_name: colorName,
      imgmatchcolor: finalImgMatchColor,
      part_img_url: resolvedPartImageUrl,
      quantity,
    };

    if (value != null) {
      insertPayload.value = value;
    }

    const { error } = await supabase.from("list_items").insert(insertPayload);

    if (
      error &&
      (/column\s+"?value"?\s+does not exist/i.test(error.message) ||
        /could not find the 'value' column/i.test(error.message) ||
        error.code === "PGRST204")
    ) {
      setStatus(statusText.missingPriceMigration);
      setListasSaving(false);
      return;
    }

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setListasSaving(false);
      return;
    }

    await loadListItems(selectedListForItems.id);
    await loadListasFromDb();
    setListItemsPage(1);
    setSelectedSearchPartNum(part.part_num);
    setStatus(`Item agregado: ${part.part_num}`);
    setListasSaving(false);
  }

  async function addSelectedPartToList() {
    if (!selectedSearchPart) {
      setStatus(statusText.selectPartFirst);
      return;
    }

    const isSaleList = selectedListForItems?.tipo === "venta";
    let salePriceValue: number | null = null;
    if (isSaleList) {
      const normalizedPrice = addItemPriceInput.trim().replace(",", ".");
      const parsed = Number(normalizedPrice);
      if (!normalizedPrice || !Number.isFinite(parsed) || parsed < 0) {
        setStatus(statusText.validSalePrice);
        return;
      }
      salePriceValue = Math.round(parsed * 100) / 100;
    }

    await addPartToList(selectedSearchPart, {
      colorName: addItemColorNameInput,
      quantity: addItemQuantity,
      colorMode: addItemColorMode,
      imgMatchColor: !selectedPartColorImageMissing,
      value: salePriceValue,
    });

    setPartsSearchQuery("");
    setPartsSearchResults([]);
    setPartsSearchLoading(false);
    setShowPartSearchDropdown(false);
    setSelectedSearchPartNum(null);
    setPartAvailableColorNames([]);
    setSelectedPartColorImageUrl(null);
    setSelectedPartColorImageMissing(false);
    setAddItemColorNameInput(NO_COLOR_LABEL);
    setAddItemQuantity(1);
    setAddItemPriceInput("");
  }

  async function openPdfExportPrint() {
    if (!selectedListForItems) {
      setStatus(statusText.noListSelectedForExport);
      return;
    }

    const lots: Lot[] = listItemsRows
      .filter((row) => Boolean(row.part_num))
      .map((row) => ({
        id: row.item_id,
        part_num: row.part_num || "",
        part_name: row.part_name || row.part_num || "",
        color_name: row.display_color_label || null,
        quantity: Math.max(1, Number(row.quantity || 1)),
        value: row.value == null ? null : Number(row.value),
      }));

    if (lots.length === 0) {
      setStatus(statusText.noPartsToExport);
      return;
    }

    const partImages: PartImageLookup = {};
    listItemsRows.forEach((row) => {
      if (!row.part_num || !row.part_img_url) {
        return;
      }
      partImages[getPartImageKey(row.part_num, row.display_color_label)] = row.part_img_url;
      partImages[getPartImageKey(row.part_num, null)] = row.part_img_url;
    });

    const displayListName = selectedListForItems.nombre;
    const isSaleList = selectedListForItems.tipo === "venta";
    const availableColors = goBrickColors.map((color) => ({
      name: color.lego || "",
      blName: color.bricklink || "",
      hex: color.hex || "d1d5db",
    }));

    const title = `${isSaleList ? labels.saleListType : labels.wishlistListType} ${displayListName}`;
    const exportDateTime = new Date().toLocaleString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const exportUserLabel = displayName || labels.noNameFallback;
    const exportEmailLabel = userEmail || labels.noMail;
    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const pdfImagesByKey: PartImageLookup = { ...partImages };

    const missingImageItems = lots
      .map((lot) => ({ part_num: lot.part_num, color_name: lot.color_name }))
      .filter((item, index, array) => {
        const key = getPartImageKey(item.part_num, item.color_name);
        if (pdfImagesByKey[key] !== undefined) return false;
        return array.findIndex((c) => getPartImageKey(c.part_num, c.color_name) === key) === index;
      });

    if (missingImageItems.length > 0) {
      try {
        const response = await fetch("/api/rebrickable/part-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: missingImageItems }),
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            results?: Array<{ key: string; part_num: string; part_img_url: string | null }>;
          };
          for (const part of payload.results ?? []) {
            const key = part.key || getPartImageKey(part.part_num, null);
            pdfImagesByKey[key] = part.part_img_url;
          }
        }
      } catch {
        // ignore image fetch errors for export
      }
    }

    const rowsHtml = lots
      .map((lot) => {
        const rawName = (lot.part_name || lot.part_num).trim();
        const normalizedPartNum = lot.part_num.trim();
        const cleanedName = rawName.replace(new RegExp(`^#?\\s*${escapeRegex(normalizedPartNum)}\\s*-\\s*`, "i"), "").trim();

        const name = escapeHtml(cleanedName || rawName);
        const colorLabel = escapeHtml(lot.color_name || labels.noColor);
        const colorHex = getColorHexFromName(lot.color_name, availableColors);
        const colorText = getTextColorForBackground(colorHex);
        const qty = Math.max(1, Number(lot.quantity || 1));

        const imageKey = getPartImageKey(lot.part_num, lot.color_name);
        const imageUrl = pdfImagesByKey[imageKey] ?? pdfImagesByKey[getPartImageKey(lot.part_num, null)] ?? null;
        const imageCell = imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="${name}" class="part-image"/>`
          : `<div class="part-image empty">${escapeHtml(labels.noImageCache)}</div>`;

        const priceCell = isSaleList ? `<td>${lot.value == null ? "" : `$${escapeHtml(String(lot.value))}`}</td>` : "";

        return `<tr><td>${imageCell}</td><td>${name}</td><td class="color-cell" style="background:${colorHex};color:${colorText};">${colorLabel}</td><td>${qty}</td>${priceCell}</tr>`;
      })
      .join("");

    const priceHeader = isSaleList ? `<th>${escapeHtml(labels.price)}</th>` : "";

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>
body{font-family:Arial,sans-serif;padding:24px;color:#111}
h1{margin:0 0 16px 0;font-size:22px}
.meta{margin:0 0 16px 0;font-size:12px;line-height:1.5}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #d1d5db;padding:8px;font-size:12px;text-align:left;vertical-align:middle}
th{background:#f3f4f6}
.part-image{width:56px;height:56px;object-fit:contain;display:block;margin:0 auto}
.part-image.empty{width:56px;height:56px;border:1px dashed #cbd5e1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#64748b;background:#f8fafc}
.color-cell{font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<p class="meta"><strong>${escapeHtml(labels.exportUser)}:</strong> ${escapeHtml(exportUserLabel)}<br/><strong>${escapeHtml(labels.exportMail)}:</strong> ${escapeHtml(exportEmailLabel)}<br/><strong>${escapeHtml(labels.exportDate)}:</strong> ${escapeHtml(exportDateTime)}</p>
<h1>${escapeHtml(title)}</h1>
<table><thead><tr><th>${escapeHtml(labels.exportImage)}</th><th>${escapeHtml(labels.exportName)}</th><th>${escapeHtml(labels.exportColor)}</th><th>${escapeHtml(labels.exportQuantity)}</th>${priceHeader}</tr></thead><tbody>${rowsHtml}</tbody></table>
</body></html>`;

    const popup = window.open("", "_blank", "width=960,height=720");
    if (!popup) {
      setStatus(statusText.printWindowFailed);
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  async function submitWishlistOfferFromPool() {
    if (!supabase || !userId || !selectedMiLugPoolItem) {
      return;
    }
    if (selectedMiLugPoolItem.type !== "wishlist") {
      return;
    }
    if (selectedMiLugPoolItem.item.publisher_id === userId) {
      setStatus(statusText.cannotOfferOwnWishlist);
      return;
    }

    const quantity = Math.max(1, Number.parseInt(miLugOfferQuantityInput || "1", 10) || 1);

    setMiLugPoolsLoading(true);
    const { error } = await supabase.from("wishlist_item_offers").upsert(
      {
        list_item_id: selectedMiLugPoolItem.item.id,
        requester_id: userId,
        quantity,
      },
      { onConflict: "list_item_id,requester_id" },
    );

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setMiLugPoolsLoading(false);
      return;
    }

    setStatus(statusText.offerSent);
    await loadMiLugPools();
    setMiLugPoolsLoading(false);
    setSelectedMiLugPoolItem(null);
  }

  async function clearWishlistOfferFromPool() {
    if (!supabase || !userId || !selectedMiLugPoolItem) {
      return;
    }
    if (selectedMiLugPoolItem.type !== "wishlist") {
      return;
    }

    setMiLugPoolsLoading(true);
    const { error } = await supabase
      .from("wishlist_item_offers")
      .delete()
      .eq("list_item_id", selectedMiLugPoolItem.item.id)
      .eq("requester_id", userId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setMiLugPoolsLoading(false);
      return;
    }

    setStatus("Oferta liberada.");
    await loadMiLugPools();
    setMiLugPoolsLoading(false);
    setSelectedMiLugPoolItem(null);
  }

  async function releaseOfferFromGivenPanel(offerId: string) {
    if (!supabase || !userId || !offerId) {
      return;
    }

    setOffersPanelsLoading(true);
    const { error } = await supabase
      .from("wishlist_item_offers")
      .delete()
      .eq("offer_id", offerId)
      .eq("requester_id", userId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setOffersPanelsLoading(false);
      return;
    }

    await Promise.all([loadOffersGivenSummary(), loadOffersReceivedSummary(), loadMiLugPools()]);
    setOffersPanelsLoading(false);
    setStatus("Oferta liberada.");
  }

  function selectPartForAddItem(part: PartCatalogItem, options?: { closeCatalog?: boolean }) {
    setPartsSearchResults([part]);
    setSelectedSearchPartNum(part.part_num);
    setPartsSearchQuery(formatPartLabel(part));
    setShowPartSearchDropdown(false);
    setPartAvailableColorNames([]);
    setSelectedPartColorImageUrl(null);
    setSelectedPartColorImageMissing(false);
    if (options?.closeCatalog !== false) {
      setShowCategoriesPanel(false);
      setCategoriesPanelMode("categories");
      setSelectedPanelCategory(null);
    }
  }

  async function deleteListItem(itemId: string) {
    if (!supabase || !selectedListForItems) {
      return;
    }

    if (selectedListForItems.nombre === AUTO_MINIFIG_MISSING_LIST_NAME) {
      setStatus("Los lotes de la lista automatica de CMF no se pueden borrar manualmente.");
      return;
    }

    setListasSaving(true);

    const { error } = await supabase.from("list_items").delete().eq("item_id", itemId).eq("list_id", selectedListForItems.id);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setListasSaving(false);
      return;
    }

    await loadListItems(selectedListForItems.id);
    await loadListasFromDb();
    setStatus(statusText.itemDeleted);
    setListasSaving(false);
  }

  async function saveListItemQuantity(itemId: string) {
    if (!supabase || !selectedListForItems) {
      return;
    }

    const raw = String(itemQuantityInputs[itemId] ?? "").trim();
    const quantity = Math.max(1, Number.parseInt(raw || "1", 10) || 1);

    setListasSaving(true);

    const { error } = await supabase
      .from("list_items")
      .update({ quantity })
      .eq("item_id", itemId)
      .eq("list_id", selectedListForItems.id);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setListasSaving(false);
      return;
    }

    setItemQuantityInputs((prev) => ({ ...prev, [itemId]: String(quantity) }));
    await loadListItems(selectedListForItems.id);
    await loadListasFromDb();
    setListasSaving(false);
  }

  async function saveListItemPrice(itemId: string) {
    if (!supabase || !selectedListForItems) {
      return;
    }

    const raw = String(itemPriceInputs[itemId] ?? "").trim().replace(",", ".");
    if (!raw) {
      setStatus(statusText.validPrice);
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setStatus(statusText.validPrice);
      return;
    }

    const value = Math.round(parsed * 100) / 100;

    setListasSaving(true);

    const { error } = await supabase
      .from("list_items")
      .update({ value })
      .eq("item_id", itemId)
      .eq("list_id", selectedListForItems.id);

    if (
      error &&
      (/column\s+"?value"?\s+does not exist/i.test(error.message) ||
        /could not find the 'value' column/i.test(error.message) ||
        error.code === "PGRST204")
    ) {
      setStatus(statusText.dbMissingPriceColumn);
      setListasSaving(false);
      return;
    }

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setListasSaving(false);
      return;
    }

    setItemPriceInputs((prev) => ({ ...prev, [itemId]: String(value) }));
    await loadListItems(selectedListForItems.id);
    await loadListasFromDb();
    setStatus(statusText.priceUpdated);
    setListasSaving(false);
  }

  function togglePanelPrintFilter(key: "no_printed" | "printed") {
    setPanelPrintFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.no_printed && !next.printed) {
        return prev;
      }
      return next;
    });
  }

  const loadCurrentLugPalette = useCallback(async (lugId: string | null) => {
    if (!supabase || !lugId) {
      setCurrentLugColor1("#006eb2");
      setCurrentLugColor2("#ffffff");
      setCurrentLugColor3("#111111");
      setCurrentLugLogoDataUrl(null);
      return;
    }

    const { data } = await supabase
      .from("lugs")
      .select("color1, color2, color3, logo_data_url")
      .eq("lug_id", lugId)
      .maybeSingle();

    setCurrentLugColor1(String(data?.color1 ?? "#006eb2"));
    setCurrentLugColor2(String(data?.color2 ?? "#ffffff"));
    setCurrentLugColor3(String(data?.color3 ?? "#111111"));
    setCurrentLugLogoDataUrl(data?.logo_data_url ? String(data.logo_data_url) : null);
  }, [supabase]);

  const backfillLegacyLugLogosToStorage = useCallback(async () => {
    if (!supabase || !isMaster || legacyLogosBackfillRunning) {
      return;
    }

    const storageKey = "lug_logos_backfill_done_v1";
    if (typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "done") {
      return;
    }

    setLegacyLogosBackfillRunning(true);

    const { data, error } = await supabase
      .from("lugs")
      .select("lug_id, logo_data_url")
      .like("logo_data_url", "data:image/%")
      .limit(25);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setLegacyLogosBackfillRunning(false);
      return;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, "done");
      }
      setLegacyLogosBackfillRunning(false);
      return;
    }

    for (const row of rows) {
      const lugId = String(row.lug_id ?? "").trim();
      const rawLogo = String(row.logo_data_url ?? "").trim();
      if (!lugId || !rawLogo.startsWith("data:image/")) {
        continue;
      }

      const mime = rawLogo.includes("image/webp") ? "image/webp" : rawLogo.includes("image/png") ? "image/png" : "image/jpeg";
      const ext = mime === "image/webp" ? "webp" : mime === "image/png" ? "png" : "jpg";

      try {
        const blobResponse = await fetch(rawLogo);
        const blob = await blobResponse.blob();
        const filePath = `${lugId}/logo.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("lug-logos")
          .upload(filePath, blob, { upsert: true, contentType: mime });

        if (uploadError) {
          continue;
        }

        const { data: publicData } = supabase.storage.from("lug-logos").getPublicUrl(filePath);
        const publicUrl = publicData.publicUrl || null;
        if (!publicUrl) {
          continue;
        }

        await supabase
          .from("lugs")
          .update({ logo_data_url: publicUrl })
          .eq("lug_id", lugId);

        if (currentLugId === lugId) {
          setCurrentLugLogoDataUrl(publicUrl);
        }
      } catch {
        continue;
      }
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "done");
    }

    setLegacyLogosBackfillRunning(false);
  }, [currentLugId, isMaster, legacyLogosBackfillRunning, supabase, t.errorPrefix]);

  const loadMyJoinRequests = useCallback(async (currentUserId: string) => {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("lug_join_requests")
      .select("lug_id")
      .eq("requester_id", currentUserId)
      .eq("status", "pending");

    if (error) {
      const fallback = await supabase.rpc("get_dashboard_bootstrap");
      if (fallback.error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
        return;
      }

      const bootstrapRows = (fallback.data ?? []) as Array<Record<string, unknown>>;
      const profileData = bootstrapRows[0] ?? null;
      const pendingLugIdsRaw = Array.isArray(profileData?.my_pending_lug_ids) ? profileData.my_pending_lug_ids : [];
      const pendingLugIds = pendingLugIdsRaw
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0);
      setRequestedLugIds(pendingLugIds);
      return;
    }

    const pendingLugIds = (data ?? [])
      .map((row) => String(row.lug_id ?? "").trim())
      .filter((value) => value.length > 0);

    setRequestedLugIds(pendingLugIds);
  }, [supabase, t.errorPrefix]);

  const loadAdminPendingRequestsCount = useCallback(async (lugId: string) => {
    if (!supabase) {
      return;
    }

    const { count, error } = await supabase
      .from("lug_join_requests")
      .select("request_id", { count: "exact", head: true })
      .eq("lug_id", lugId)
      .eq("status", "pending");

    if (error) {
      const fallback = await supabase.rpc("get_lug_pending_requests", {
        target_lug_id: lugId,
      });
      if (fallback.error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
        return;
      }

      const fallbackRows = (fallback.data ?? []) as Array<Record<string, unknown>>;
      setAdminPendingRequestsCount(fallbackRows.length);
      return;
    }

    setAdminPendingRequestsCount(Number(count ?? 0));
  }, [supabase, t.errorPrefix]);

  const loadAdminPendingRequestsList = useCallback(async (lugId: string) => {
    if (!supabase) {
      return;
    }

    setAdminRequestsLoading(true);

    const { data, error } = await supabase.rpc("get_lug_pending_requests", {
      target_lug_id: lugId,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setAdminRequests([]);
      setAdminRequestsLoading(false);
      return;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const parsed = rows.map((row) => ({
      request_id: String(row.request_id ?? ""),
      requester_id: String(row.requester_id ?? ""),
      lug_id: String(row.lug_id ?? ""),
      full_name: String(row.full_name ?? "Usuario"),
      social_platform: row.social_platform ? String(row.social_platform) : null,
      social_handle: row.social_handle ? String(row.social_handle) : null,
      request_message: row.request_message ? String(row.request_message) : null,
      contact_social: row.contact_social ? String(row.contact_social) : null,
      created_at: String(row.created_at ?? ""),
    }));

    setAdminRequests(parsed);
    setAdminRequestsLoading(false);
  }, [supabase, t.errorPrefix]);

  const loadMasterEmptyNotificationsCount = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { count, error } = await supabase
      .from("lug_empty_notifications")
      .select("notification_id", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) {
      const fallback = await supabase.rpc("get_master_empty_lug_notifications");
      if (fallback.error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
        return;
      }

      const fallbackRows = (fallback.data ?? []) as Array<Record<string, unknown>>;
      setMasterEmptyNotificationsCount(fallbackRows.length);
      return;
    }

    setMasterEmptyNotificationsCount(Number(count ?? 0));
  }, [supabase, t.errorPrefix]);

  const loadMasterEmptyNotificationsList = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setMasterEmptyLugsLoading(true);

    const { data, error } = await supabase.rpc("get_master_empty_lug_notifications");
    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setMasterEmptyLugs([]);
      setMasterEmptyLugsLoading(false);
      return;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const parsed = rows.map((row) => ({
      notification_id: String(row.notification_id ?? ""),
      lug_id: String(row.lug_id ?? ""),
      nombre: String(row.nombre ?? ""),
      pais: row.pais ? String(row.pais) : null,
      descripcion: row.descripcion ? String(row.descripcion) : null,
      created_at: String(row.created_at ?? ""),
    }));

    setMasterEmptyLugs(parsed);
    setMasterEmptyLugsLoading(false);
  }, [supabase, t.errorPrefix]);

  const ensureProfile = useCallback(async (currentUserId: string, currentEmail: string | null) => {
    if (!supabase) {
      return;
    }

    const fallbackUsername = String(currentEmail ?? "usuario").split("@")[0] || "usuario";
    await supabase.from("profiles").upsert(
      {
        id: currentUserId,
        username: fallbackUsername,
      },
      { onConflict: "id" },
    );
  }, [supabase]);

  const loadUserState = useCallback(async (currentUserId: string, currentEmail: string | null) => {
    if (!supabase) {
      return;
    }

    await ensureProfile(currentUserId, currentEmail);

    const { data, error } = await supabase.rpc("get_dashboard_bootstrap");

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    const bootstrapRows = (data ?? []) as Array<Record<string, unknown>>;
    const profileData = bootstrapRows[0] ?? null;

    const fallbackName = String(currentEmail ?? "Usuario").split("@")[0] || "Usuario";
    const fullName = String(profileData?.full_name ?? "").trim();
    const lang = String(profileData?.preferred_language ?? "es");
    const face = parseAvatarFace(profileData?.avatar_key ? String(profileData.avatar_key) : null);
    const nextCurrentLugId = String(profileData?.current_lug_id ?? "").trim() || null;
    const nextRolLug = String(profileData?.rol_lug ?? "").trim();
    setUserId(currentUserId);
    setUserEmail(currentEmail);
    setIsMaster(Boolean(profileData?.is_master));
    setCurrentLugId(nextCurrentLugId);
    setRolLug(nextRolLug === "admin" ? "admin" : nextRolLug === "common" ? "common" : null);
    setCurrentLugColor1(String(profileData?.current_lug_color1 ?? "#006eb2"));
    setCurrentLugColor2(String(profileData?.current_lug_color2 ?? "#ffffff"));
    setCurrentLugColor3(String(profileData?.current_lug_color3 ?? "#111111"));
    setCurrentLugLogoDataUrl(profileData?.current_lug_logo_data_url ? String(profileData.current_lug_logo_data_url) : null);
    const pendingLugIdsRaw = Array.isArray(profileData?.my_pending_lug_ids) ? profileData.my_pending_lug_ids : [];
    const pendingLugIds = pendingLugIdsRaw
      .map((value) => String(value ?? "").trim())
      .filter((value) => value.length > 0);
    setRequestedLugIds(pendingLugIds);
    setAdminPendingRequestsCount(Number(profileData?.admin_pending_requests_count ?? 0));
    setMasterEmptyNotificationsCount(Number(profileData?.master_empty_notifications_count ?? 0));
    setMaintenanceEnabled(Boolean(profileData?.maintenance_enabled));
    setMaintenanceMessageLine1(String(profileData?.maintenance_message_line1 ?? "Estamos en mantenimiento"));
    setMaintenanceMessageLine2(String(profileData?.maintenance_message_line2 ?? "Volvé en un rato"));
    setFooterLegend(String(profileData?.maintenance_footer_legend ?? "LUGs App"));

    setDisplayName(fullName || fallbackName);
    setSelectedFace(face);
    setPreviewFace(face);

    if (lang === "es" || lang === "en" || lang === "pt") {
      setLanguage(lang);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ui_language", lang);
      }
    }
  }, [ensureProfile, supabase, t.errorPrefix]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const init = async () => {
      startBootLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        await loadUserState(user.id, user.email ?? null);
        await loadMaintenanceSettings();
      } else {
        setUserId(null);
        setUserEmail(null);
        setActiveSection("dashboard");
        setListasItems([]);
        setIsMaster(false);
        setCurrentLugId(null);
        setRolLug(null);
        setRequestedLugIds([]);
        setAdminPendingRequestsCount(0);
        setShowAdminRequestsPanel(false);
        setAdminRequests([]);
        setShowJoinRequestFormPanel(false);
        setJoinRequestTargetLugId(null);
        setJoinRequestTargetLugName("");
        setJoinRequestMessageInput("");
        setJoinRequestSocialInput("");
        setShowAdminRequestDetailPanel(false);
        setSelectedAdminRequest(null);
        setCurrentLugColor1("#006eb2");
        setCurrentLugColor2("#ffffff");
        setCurrentLugColor3("#111111");
        setCurrentLugLogoDataUrl(null);
        setMasterEmptyNotificationsCount(0);
        setShowMasterEmptyLugsPanel(false);
        setMasterEmptyLugs([]);
        setShowLugAccessConfirmPanel(false);
        setPendingLugAccessAction(null);
        setMaintenanceEnabled(false);
        setMaintenanceMessageLine1("Estamos en mantenimiento");
        setMaintenanceMessageLine2("Volvé en un rato");
        setSelectedListForItems(null);
        setListItemsRows([]);
      }

      setAppBootLoading(false);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        startBootLoading();
        if (session?.user?.id) {
          await loadUserState(session.user.id, session.user.email ?? null);
          await loadMaintenanceSettings();
        } else {
          setUserId(null);
          setUserEmail(null);
          setActiveSection("dashboard");
          setListasItems([]);
          setDisplayName("Usuario");
          setIsMaster(false);
          setCurrentLugId(null);
          setRolLug(null);
          setRequestedLugIds([]);
          setAdminPendingRequestsCount(0);
          setShowAdminRequestsPanel(false);
          setAdminRequests([]);
          setShowJoinRequestFormPanel(false);
          setJoinRequestTargetLugId(null);
          setJoinRequestTargetLugName("");
          setJoinRequestMessageInput("");
          setJoinRequestSocialInput("");
          setShowAdminRequestDetailPanel(false);
          setSelectedAdminRequest(null);
          setCurrentLugColor1("#006eb2");
          setCurrentLugColor2("#ffffff");
          setCurrentLugColor3("#111111");
          setCurrentLugLogoDataUrl(null);
          setMasterEmptyNotificationsCount(0);
          setShowMasterEmptyLugsPanel(false);
          setMasterEmptyLugs([]);
          setShowLugAccessConfirmPanel(false);
          setPendingLugAccessAction(null);
          setMaintenanceEnabled(false);
          setMaintenanceMessageLine1("Estamos en mantenimiento");
          setMaintenanceMessageLine2("Volvé en un rato");
          setSelectedListForItems(null);
          setListItemsRows([]);
        }
        setAppBootLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, [loadMaintenanceSettings, loadUserState, router, startBootLoading, supabase]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (activeSection !== "listas") {
      return;
    }

    void openListasSection({ navigate: false });
  }, [activeSection, openListasSection, userId]);

  useEffect(() => {
    if (!supabase || !userId) {
      setDashboardListsCreatedCount(0);
      return;
    }

    let cancelled = false;
    void (async () => {
      const { count } = await supabase
        .from("lists")
        .select("list_id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .in("list_type", ["deseos", "venta"]);

      if (!cancelled) {
        setDashboardListsCreatedCount(Number(count ?? 0));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (goBrickColors.length > 0) {
      return;
    }

    void loadGoBrickColors();
  }, [goBrickColors.length, userId, loadGoBrickColors]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (activeSection !== "minifiguras") {
      return;
    }

    void loadCollectibleSeries();
  }, [activeSection, loadCollectibleSeries, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (activeSection !== "minifiguras" && activeSection !== "balance_usuario") {
      return;
    }

    void loadMinifigGlobalOwnedStats();
  }, [activeSection, loadMinifigGlobalOwnedStats, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (activeSection !== "configuracion_personal") {
      return;
    }

    void openUserSettings({ mode: "page", navigate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, userId]);

  useEffect(() => {
    if (!supabase || !userId) {
      return;
    }
    if (activeSection !== "minifiguras") {
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("minifig_user_ui_preferences")
        .select("show_only_favorite_series, show_only_favorite_figures")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled || !data) {
        return;
      }

      const onlyFavoriteSeries = Boolean((data as { show_only_favorite_series?: unknown }).show_only_favorite_series);
      const onlyFavoriteFigures = Boolean((data as { show_only_favorite_figures?: unknown }).show_only_favorite_figures);
      setShowOnlyFavoriteSeries(onlyFavoriteSeries);
      setShowOnlyFavoriteFigures(onlyFavoriteFigures);
      setMinifigFiguresFilter(onlyFavoriteFigures ? "favorite" : "all");
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSection, supabase, userId]);

  useEffect(() => {
    if (activeSection !== "minifiguras") {
      return;
    }

    const handle = window.setTimeout(() => {
      void loadMinifigSearchResults(minifigSearchQuery);
    }, 220);

    return () => {
      window.clearTimeout(handle);
    };
  }, [activeSection, loadMinifigSearchResults, minifigSearchQuery]);

  useEffect(() => {
    if (!userId || !supabase) {
      return;
    }

    if (activeSection !== "minifiguras") {
      return;
    }

    if (minifigSeriesRows.length === 0) {
      return;
    }

    const debounceHandle = window.setTimeout(() => {
      if (!minifigMissingWishlistSyncing) {
        void syncAutoMinifigMissingWishlist(minifigContextMissingSetNums);
      }
    }, 500);

    return () => {
      window.clearTimeout(debounceHandle);
    };
  }, [activeSection, minifigContextMissingSetNums, minifigMissingWishlistSyncing, minifigSeriesRows.length, minifigSetHasMissingPartsBySetNum, supabase, syncAutoMinifigMissingWishlist, userId]);

  useEffect(() => {
    if (!supabase || !showMemberChatPopup || !selectedMemberChat?.roomId) {
      return;
    }

    const roomId = selectedMemberChat.roomId;
    const channel = supabase
      .channel(`member-chat-popup-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        const nextMessage: MemberChatMessageItem = {
          message_id: String(row.message_id ?? "").trim(),
          room_id: String(row.room_id ?? "").trim(),
          sender_id: (() => {
            const value = String(row.sender_id ?? "").trim();
            return value || null;
          })(),
          content: String(row.content ?? ""),
          created_at: String(row.created_at ?? "").trim(),
          edited_at: (() => {
            const value = String(row.edited_at ?? "").trim();
            return value || null;
          })(),
        };

        if (!nextMessage.message_id) {
          return;
        }

        setMemberChatMessages((prev) => {
          if (prev.some((message) => message.message_id === nextMessage.message_id)) {
            return prev;
          }
          return [...prev, nextMessage];
        });

        if (nextMessage.sender_id && nextMessage.sender_id !== userId) {
          void supabase.rpc("chat_mark_room_read", {
            p_room_id: roomId,
            p_last_message_id: nextMessage.message_id,
          });
          void loadUnreadChatsCount();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        const messageId = String(row.message_id ?? "").trim();
        if (!messageId) {
          return;
        }

        setMemberChatMessages((prev) =>
          prev.map((message) =>
            message.message_id === messageId
              ? {
                  ...message,
                  content: String(row.content ?? message.content),
                  edited_at: (() => {
                    const value = String(row.edited_at ?? "").trim();
                    return value || null;
                  })(),
                }
              : message,
          ),
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadUnreadChatsCount, selectedMemberChat?.roomId, showMemberChatPopup, supabase, userId]);

  useEffect(() => {
    if (!supabase || !userId) {
      setUnreadChatsCount(0);
      return;
    }

    void loadUnreadChatsCount();
    const handle = window.setInterval(() => {
      void loadUnreadChatsCount();
    }, 6000);

    return () => {
      window.clearInterval(handle);
    };
  }, [loadUnreadChatsCount, supabase, userId]);

  useEffect(() => {
    if (!showMemberChatPopup) {
      return;
    }

    const handle = window.setTimeout(() => {
      const container = memberChatScrollRef.current;
      if (!container) {
        return;
      }
      container.scrollTop = container.scrollHeight;
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [memberChatLoading, memberChatMessages.length, showMemberChatPopup]);

  useEffect(() => {
    if (!supabase || !showMemberChatPopup || !selectedMemberChat?.roomId) {
      return;
    }

    const roomId = selectedMemberChat.roomId;
    const refreshMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("message_id, room_id, sender_id, content, created_at, edited_at")
        .eq("room_id", roomId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(120);

      if (error) {
        return;
      }

      const refreshed: MemberChatMessageItem[] = ((data ?? []) as Array<Record<string, unknown>>)
        .map((row) => ({
          message_id: String(row.message_id ?? "").trim(),
          room_id: String(row.room_id ?? "").trim(),
          sender_id: (() => {
            const value = String(row.sender_id ?? "").trim();
            return value || null;
          })(),
          content: String(row.content ?? ""),
          created_at: String(row.created_at ?? "").trim(),
          edited_at: (() => {
            const value = String(row.edited_at ?? "").trim();
            return value || null;
          })(),
        }))
        .filter((row) => row.message_id);

      setMemberChatMessages((prev) => {
        const prevLast = prev[prev.length - 1]?.message_id ?? "";
        const nextLast = refreshed[refreshed.length - 1]?.message_id ?? "";
        if (prev.length === refreshed.length && prevLast === nextLast) {
          return prev;
        }
        return refreshed;
      });
    };

    const handle = window.setInterval(() => {
      void refreshMessages();
    }, 3500);

    return () => {
      window.clearInterval(handle);
    };
  }, [selectedMemberChat?.roomId, showMemberChatPopup, supabase]);

  useEffect(() => {
    setListItemsPage(1);
  }, [selectedListForItems?.id]);

  useEffect(() => {
    setMiLugMembersPage(1);
  }, [miLugMembersRows.length]);

  useEffect(() => {
    if (!userId || !currentLugId) {
      return;
    }
    if (activeSection !== "mi_lug") {
      return;
    }

    void loadMiLugPools();
  }, [activeSection, currentLugId, loadMiLugPools, userId]);

  useEffect(() => {
    if (!userId || !currentLugId) {
      return;
    }
    if (activeSection !== "mi_lug") {
      return;
    }

    void loadMiLugMembersList();
  }, [activeSection, currentLugId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection !== "minifiguras") {
      return;
    }

    checkedMinifigSeriesIds.forEach((seriesId) => {
      const cachedRows = minifigFiguresBySeriesId[seriesId];
      if (cachedRows && cachedRows.length > 0) {
        return;
      }
      void loadMinifigFiguresForSeries(seriesId);
    });
  }, [activeSection, checkedMinifigSeriesIds, loadMinifigFiguresForSeries, minifigFiguresBySeriesId]);

  useEffect(() => {
    if (!supabase || !currentLugId) {
      return;
    }
    if (activeSection !== "mi_lug") {
      return;
    }

    const client = supabase;

    let cancelled = false;

    async function loadMiLugHeader() {
      const { data } = await client
        .from("lugs")
        .select("nombre, logo_data_url")
        .eq("lug_id", currentLugId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      setMiLugHeaderName(data?.nombre ? String(data.nombre) : null);
      setMiLugHeaderLogo(data?.logo_data_url ? String(data.logo_data_url) : null);
    }

    void loadMiLugHeader();

    return () => {
      cancelled = true;
    };
  }, [activeSection, currentLugId, supabase]);

  useEffect(() => {
    if (!selectedMiLugPoolItem) {
      setMiLugOfferQuantityInput("1");
      return;
    }

    const current = Math.max(1, Number(selectedMiLugPoolItem.item.current_user_offer_quantity || 1));
    setMiLugOfferQuantityInput(String(current));
  }, [selectedMiLugPoolItem]);

  useEffect(() => {
    if (!userId || !isMaster) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void backfillLegacyLugLogosToStorage();
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [backfillLegacyLugLogosToStorage, isMaster, userId]);

  useEffect(() => {
    if (!supabase || !userId) {
      return;
    }

    const channel = supabase
      .channel(`lug-join-requests-own-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lug_join_requests",
          filter: `requester_id=eq.${userId}`,
        },
        (payload: { eventType: string; new?: { status?: string } }) => {
          void loadMyJoinRequests(userId);
          const maybeStatus = String(payload.new?.status ?? "");
          if (payload.eventType === "UPDATE" && maybeStatus === "accepted") {
            void loadUserState(userId, userEmail ?? null);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMyJoinRequests, loadUserState, supabase, userEmail, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void loadMyJoinRequests(userId);
  }, [loadMyJoinRequests, userId]);

  useEffect(() => {
    if (!supabase || !userId || rolLug !== "admin" || !currentLugId) {
      return;
    }

    const channel = supabase
      .channel(`lug-join-requests-admin-${currentLugId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lug_join_requests",
          filter: `lug_id=eq.${currentLugId}`,
        },
        () => {
          void loadAdminPendingRequestsCount(currentLugId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentLugId, loadAdminPendingRequestsCount, rolLug, supabase, userId]);

  useEffect(() => {
    if (!userId || rolLug !== "admin" || !currentLugId) {
      return;
    }

    void loadAdminPendingRequestsCount(currentLugId);

    const intervalId = window.setInterval(() => {
      void loadAdminPendingRequestsCount(currentLugId);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [currentLugId, loadAdminPendingRequestsCount, rolLug, userId]);

  useEffect(() => {
    if (!showAdminRequestsPanel || !currentLugId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadAdminPendingRequestsList(currentLugId);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [currentLugId, loadAdminPendingRequestsList, showAdminRequestsPanel]);

  useEffect(() => {
    if (!userId || !isMaster) {
      return;
    }

    void loadMasterEmptyNotificationsCount();

    const intervalId = window.setInterval(() => {
      void loadMasterEmptyNotificationsCount();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [isMaster, loadMasterEmptyNotificationsCount, userId]);

  useEffect(() => {
    if (!showMasterEmptyLugsPanel) {
      return;
    }

    void loadMasterEmptyNotificationsList();

    const intervalId = window.setInterval(() => {
      void loadMasterEmptyNotificationsList();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [loadMasterEmptyNotificationsList, showMasterEmptyLugsPanel]);

  useEffect(() => {
    if (!showMasterPanel) {
      return;
    }
    setMaintenanceDraftFooterLegend(footerLegend || "");
  }, [footerLegend, showMasterPanel]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadMaintenanceSettings();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [loadMaintenanceSettings, userId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("active_section_v1", activeSection === "lista_detalle" ? "listas" : activeSection);
  }, [activeSection]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem("auth_cooldown_until_v1");
    const parsed = Number(raw ?? 0);
    if (Number.isFinite(parsed) && parsed > 0) {
      setAuthCooldownUntil(parsed);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (authCooldownUntil > 0) {
      window.localStorage.setItem("auth_cooldown_until_v1", String(authCooldownUntil));
    } else {
      window.localStorage.removeItem("auth_cooldown_until_v1");
    }
  }, [authCooldownUntil]);

  useEffect(() => {
    if (authCooldownUntil <= Date.now()) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setAuthNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authCooldownUntil]);

  useEffect(() => {
    if (!initialListId) {
      return;
    }
    if (!userId) {
      return;
    }
    if (selectedListForItems?.id === initialListId) {
      return;
    }
    if (activeSection !== "listas") {
      return;
    }

    if (listasLoading) {
      return;
    }

    if (listasItems.length === 0) {
      void loadListasFromDb();
      return;
    }

    const fromMemory = listasItems.find((item) => item.id === initialListId);
    if (fromMemory) {
      void openListDetailPage(fromMemory, { navigate: false });
      return;
    }

    void openListDetailById(initialListId, userId);
  }, [activeSection, initialListId, listasItems, listasLoading, loadListasFromDb, openListDetailById, openListDetailPage, selectedListForItems?.id, userId]);

  function getAuthErrorStatus(message: string) {
    const normalized = message.trim().toLowerCase();

    if (normalized.includes("email rate limit exceeded")) {
      return "Demasiados intentos de email. Espera 60 segundos e intentalo de nuevo.";
    }
    if (normalized.includes("you can only request this after")) {
      return "Demasiados intentos seguidos. Espera un momento y vuelve a intentar.";
    }
    if (normalized.includes("invalid login credentials")) {
      return "Email o contrasena incorrectos.";
    }
    if (normalized.includes("user already registered")) {
      return "Ese email ya esta registrado. Usa Iniciar sesion.";
    }

    return `${t.errorPrefix}: ${message}`;
  }

  function getAuthRetryDelaySeconds(message: string) {
    const normalized = message.trim().toLowerCase();
    const explicitMatch = normalized.match(/after\s+(\d+)\s+seconds?/i);
    if (explicitMatch) {
      const seconds = Number(explicitMatch[1] ?? 0);
      return Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
    }
    if (normalized.includes("email rate limit exceeded") || normalized.includes("you can only request this after")) {
      return 60;
    }
    return 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    if (authCooldownRemaining > 0) {
      setStatus(`Espera ${authCooldownRemaining}s antes de volver a intentar.`);
      return;
    }

    setLoading(true);

    if (!supabase) {
      setStatus(t.missingEnv);
      setLoading(false);
      return;
    }

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        const retrySeconds = getAuthRetryDelaySeconds(error.message);
        if (retrySeconds > 0) {
          setAuthCooldownUntil(Date.now() + retrySeconds * 1000);
          setAuthNowMs(Date.now());
        }
        setStatus(getAuthErrorStatus(error.message));
      } else {
        setAuthCooldownUntil(0);
        setStatus(t.accountCreated);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const retrySeconds = getAuthRetryDelaySeconds(error.message);
        if (retrySeconds > 0) {
          setAuthCooldownUntil(Date.now() + retrySeconds * 1000);
          setAuthNowMs(Date.now());
        }
        setStatus(getAuthErrorStatus(error.message));
      } else {
        setAuthCooldownUntil(0);
        setStatus("");
      }
    }

    setLoading(false);
  }

  async function handleResendConfirmationEmail() {
    setStatus("");

    if (authCooldownRemaining > 0) {
      setStatus(`Espera ${authCooldownRemaining}s antes de volver a intentar.`);
      return;
    }

    const targetEmail = email.trim();
    if (!targetEmail) {
      setStatus(t.resendConfirmationEmailRequired);
      return;
    }

    if (!supabase) {
      setStatus(t.missingEnv);
      return;
    }

    setLoading(true);
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });

    if (error) {
      const retrySeconds = getAuthRetryDelaySeconds(error.message);
      if (retrySeconds > 0) {
        setAuthCooldownUntil(Date.now() + retrySeconds * 1000);
        setAuthNowMs(Date.now());
      }
      setStatus(getAuthErrorStatus(error.message));
    } else {
      setAuthCooldownUntil(0);
      setStatus(t.resendConfirmationSent);
    }

    setLoading(false);
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  }

  async function changeUiLanguage(next: UiLanguage) {
    if (next === language) {
      setShowLanguagePickerPopup(false);
      return;
    }

    setLanguageChanging(true);
    setLanguage(next);
    setSettingsLanguageInput(next);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("ui_language", next);
    }

    if (supabase && userId) {
      await ensureProfile(userId, userEmail);
      const { error } = await supabase.from("profiles").update({ preferred_language: next }).eq("id", userId);
      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
      }
    }

    setShowLanguagePickerPopup(false);
    setLanguageChanging(false);
  }

  async function openUserSettings(options?: { mode?: "popup" | "page"; navigate?: boolean }) {
    if (!supabase || !userId) {
      return;
    }

    const mode = options?.mode ?? "popup";
    const shouldNavigate = options?.navigate ?? false;

    if (mode === "page" && shouldNavigate) {
      navigateSectionClient("configuracion_personal", "/configuracion-personal");
    }

    await ensureProfile(userId, userEmail);

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, social_platform, social_handle, brickset_user_hash, brickset_username, avatar_key, preferred_language, current_lug_id, rol_lug")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    const fallbackName = String(userEmail ?? "Usuario").split("@")[0] || "Usuario";
    setSettingsNameInput(String(data?.full_name ?? fallbackName));
    setSettingsEmailInput(userEmail ?? "");
    setSettingsSocialPlatform(String(data?.social_platform ?? "instagram") === "facebook" ? "facebook" : "instagram");
    setSettingsSocialHandle(String(data?.social_handle ?? ""));
    setSettingsBricksetUserHash(String(data?.brickset_user_hash ?? ""));
    setSettingsBricksetUsername(String(data?.brickset_username ?? ""));
    const preferredLanguage = String(data?.preferred_language ?? language);
    setSettingsLanguageInput(preferredLanguage === "en" ? "en" : preferredLanguage === "pt" ? "pt" : "es");
    setRolLug(String(data?.rol_lug ?? "") === "admin" ? "admin" : String(data?.rol_lug ?? "") === "common" ? "common" : null);

    const resolvedSettingsLugId = String(data?.current_lug_id ?? currentLugId ?? "").trim() || null;
    setSettingsLugId(resolvedSettingsLugId);

    const face = parseAvatarFace(data?.avatar_key);
    setSelectedFace(face);
    setPreviewFace(face);

    if (resolvedSettingsLugId) {
      const { data: lugData } = await supabase
        .from("lugs")
        .select("nombre")
        .eq("lug_id", resolvedSettingsLugId)
        .maybeSingle();

      setSettingsLugName(String(lugData?.nombre ?? labels.noLug));
    } else {
      setSettingsLugName(labels.noLug);
    }

    setShowPasswordFields(false);
    setSettingsPasswordInput("");
    setSettingsPasswordConfirmInput("");
    setShowFacePicker(false);
    setShowUserSettings(mode === "popup");
  }

  async function saveUserSettings() {
    if (!supabase || !userId) {
      return;
    }

    setSettingsSaving(true);

    if (showPasswordFields) {
      if (settingsPasswordInput.length < 6) {
        setStatus(statusText.passwordMinLength);
        setSettingsSaving(false);
        return;
      }

      if (settingsPasswordInput !== settingsPasswordConfirmInput) {
        setStatus(statusText.passwordsMismatch);
        setSettingsSaving(false);
        return;
      }
    }

    await ensureProfile(userId, userEmail);

    const avatarValue = `Cabeza_${String(selectedFace).padStart(2, "0")}.png`;
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: settingsNameInput.trim() || null,
        social_platform: settingsSocialPlatform || null,
        social_handle: settingsSocialHandle.trim() || null,
        brickset_user_hash: settingsBricksetUserHash.trim() || null,
        brickset_username: settingsBricksetUsername.trim() || null,
        avatar_key: avatarValue,
        preferred_language: settingsLanguageInput,
      })
      .eq("id", userId);

    if (profileError) {
      setStatus(`${t.errorPrefix}: ${profileError.message}`);
      setSettingsSaving(false);
      return;
    }

    if (settingsEmailInput && settingsEmailInput !== userEmail) {
      const { error: emailError } = await supabase.auth.updateUser({ email: settingsEmailInput });
      if (emailError) {
        setStatus(`${t.errorPrefix}: ${emailError.message}`);
        setSettingsSaving(false);
        return;
      }
      setUserEmail(settingsEmailInput);
    }

    if (showPasswordFields) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: settingsPasswordInput });
      if (passwordError) {
        setStatus(`${t.errorPrefix}: ${passwordError.message}`);
        setSettingsSaving(false);
        return;
      }
    }

    setDisplayName(settingsNameInput.trim() || displayName);
    setLanguage(settingsLanguageInput);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ui_language", settingsLanguageInput);
    }

    setShowUserSettings(false);
    setShowFacePicker(false);
    setShowPasswordFields(false);
    setSettingsPasswordInput("");
    setSettingsPasswordConfirmInput("");
    setSettingsSaving(false);
    setStatus(statusText.settingsSaved);
  }

  async function deleteCurrentUserAccount() {
    if (!supabase || !userId || deletingUserAccount) {
      return;
    }

    setDeletingUserAccount(true);

    const authHeaders = await getSupabaseAuthHeaders();
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeaders ?? {}),
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setStatus(payload.error || "No se pudo desarmar el usuario.");
      setDeletingUserAccount(false);
      return;
    }

    await supabase.auth.signOut();
    setDeletingUserAccount(false);
    setShowDeleteUserConfirmPopup(false);
    router.push("/");
  }

  async function handleMasterLogoFileChange(file: File | null) {
    setLugLogoError("");

    if (!file) {
      setLugLogoDataUrl(null);
      setLugLogoFile(null);
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });

    await new Promise<void>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        if (img.width > 500 || img.height > 500) {
          setLugLogoError("La imagen debe ser maximo 500x500 px.");
          setLugLogoDataUrl(null);
          setLugLogoFile(null);
        } else {
          setLugLogoDataUrl(dataUrl);
          setLugLogoFile(file);
        }
        resolve();
      };
      img.onerror = () => {
        setLugLogoError("No pudimos leer la imagen.");
        setLugLogoDataUrl(null);
        setLugLogoFile(null);
        resolve();
      };
      img.src = dataUrl;
    });
  }

  async function uploadLugLogoFile(targetLugId: string, file: File) {
    if (!supabase) {
      return null;
    }

    const normalizedName = file.name.toLowerCase();
    const ext = normalizedName.endsWith(".png") ? "png" : normalizedName.endsWith(".webp") ? "webp" : "jpg";
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const filePath = `${targetLugId}/logo.${ext}`;

    const { error } = await supabase.storage
      .from("lug-logos")
      .upload(filePath, file, { upsert: true, contentType });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from("lug-logos").getPublicUrl(filePath);
    return data.publicUrl || null;
  }

  async function createLugFromMaster(assignCreatorToNewLug: boolean) {
    if (!supabase) {
      return;
    }

    if (!lugNombre.trim()) {
      setStatus(statusText.lugNameRequired);
      return;
    }

    setCreatingLug(true);

    const { data: createdLug, error } = await supabase
      .from("lugs")
      .insert({
        nombre: lugNombre.trim(),
        pais: lugPais.trim() || null,
        descripcion: lugDescripcion.trim() || null,
        color1: lugColor1.trim() || null,
        color2: lugColor2.trim() || null,
        color3: lugColor3.trim() || null,
        logo_data_url: null,
      })
      .select("lug_id, nombre")
      .single();

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setCreatingLug(false);
      return;
    }

    if (createdLug?.lug_id && lugLogoFile) {
      const uploadedLogoUrl = await uploadLugLogoFile(String(createdLug.lug_id), lugLogoFile);
      if (uploadedLogoUrl) {
        const { error: logoUpdateError } = await supabase
          .from("lugs")
          .update({ logo_data_url: uploadedLogoUrl })
          .eq("lug_id", createdLug.lug_id);

        if (logoUpdateError) {
          setStatus(`${t.errorPrefix}: ${logoUpdateError.message}`);
        }
      }
    }

    setLugNombre("");
    setLugPais("");
    setLugDescripcion("");
    setLugColor1("#006eb2");
    setLugColor2("#ffffff");
    setLugColor3("#111111");
    setLugLogoDataUrl(null);
    setLugLogoFile(null);
    setLugLogoError("");

    if (assignCreatorToNewLug && userId && createdLug?.lug_id) {
      const { error: assignError } = await supabase
        .from("profiles")
        .update({
          current_lug_id: createdLug.lug_id,
          rol_lug: "admin",
        })
        .eq("id", userId);

      if (assignError) {
        setStatus(`${t.errorPrefix}: ${assignError.message}`);
        setCreatingLug(false);
        return;
      }

      setCurrentLugId(String(createdLug.lug_id));
      setSettingsLugId(String(createdLug.lug_id));
      setSettingsLugName(String(createdLug.nombre ?? ""));
      setRolLug("admin");
      await loadCurrentLugPalette(String(createdLug.lug_id));
      await loadMyJoinRequests(userId);
    }

    setShowCreateLugPanel(false);
    setCreateLugFromListFlow(false);
    setShowCreateLugConfirmPanel(false);
    await loadMasterLugs();
    setCreatingLug(false);
    setStatus(assignCreatorToNewLug ? "LUG creado y asignado al usuario." : "LUG creado correctamente.");
  }

  async function assignCurrentLug(lugId: string) {
    if (!supabase || !userId) {
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        current_lug_id: lugId,
      })
      .eq("id", userId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setCurrentLugId(lugId);
    setSettingsLugId(lugId);
    await loadCurrentLugPalette(lugId);
    setStatus(statusText.lugAssigned);
  }

  function openJoinRequestForm(lugId: string, lugName: string) {
    if (!userId) {
      return;
    }

    setJoinRequestTargetLugId(lugId);
    setJoinRequestTargetLugName(lugName);
    setJoinRequestMessageInput("");
    setJoinRequestSocialInput("");
    setShowJoinRequestFormPanel(true);
  }

  async function cancelLugJoinRequest(lugId: string, lugName: string) {
    if (!supabase || !userId) {
      return;
    }

    setRequestActionLoadingLugId(lugId);

    const { error } = await supabase
      .from("lug_join_requests")
      .update({ status: "cancelled" })
      .eq("requester_id", userId)
      .eq("lug_id", lugId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setRequestActionLoadingLugId(null);
      return;
    }

    setStatus(`Solicitud cancelada para ${lugName}.`);

    await loadMyJoinRequests(userId);
    if (rolLug === "admin" && currentLugId) {
      await loadAdminPendingRequestsCount(currentLugId);
    }

    setRequestActionLoadingLugId(null);
  }

  async function sendLugJoinRequest() {
    if (!supabase || !userId || !joinRequestTargetLugId) {
      return;
    }

    setJoinRequestSending(true);

    const { error } = await supabase.from("lug_join_requests").upsert(
      {
        requester_id: userId,
        lug_id: joinRequestTargetLugId,
        status: "pending",
        request_message: joinRequestMessageInput.trim() || null,
        contact_social: joinRequestSocialInput.trim() || null,
      },
      { onConflict: "requester_id,lug_id" },
    );

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setJoinRequestSending(false);
      return;
    }

    setStatus(`Solicitud de ingreso enviada para ${joinRequestTargetLugName}.`);
    await loadMyJoinRequests(userId);
    if (rolLug === "admin" && currentLugId) {
      await loadAdminPendingRequestsCount(currentLugId);
    }

    setJoinRequestSending(false);
    setShowJoinRequestFormPanel(false);
    setJoinRequestTargetLugId(null);
    setJoinRequestTargetLugName("");
    setJoinRequestMessageInput("");
    setJoinRequestSocialInput("");
  }

  async function openAdminRequestsPanel() {
    if (!currentLugId) {
      return;
    }

    setShowAdminRequestsPanel(true);
    await loadAdminPendingRequestsList(currentLugId);
  }

  async function openMasterEmptyLugsPanel() {
    setShowMasterEmptyLugsPanel(true);
    await loadMasterEmptyNotificationsList();
  }

  async function loadMiLugMembersList(options?: { openPanel?: boolean }) {
    if (!supabase || !currentLugId) {
      return;
    }

    if (options?.openPanel) {
      setShowMiLugMembersPanel(true);
    }
    setMiLugMembersLoading(true);

    const { data, error } = await supabase.rpc("get_lug_members_current", {
      target_lug_id: currentLugId,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setMiLugMembersRows([]);
      setMiLugMembersLoading(false);
      return;
    }

    const membersRows = (data ?? []) as Array<Record<string, unknown>>;
    const memberIds = membersRows.map((member) => String(member.id ?? "").trim()).filter(Boolean);
    const avatarById = await fetchProfileAvatarsByIds(memberIds);
    const members = membersRows
      .map((member) => ({
        id: String(member.id ?? ""),
        full_name: String(member.full_name ?? "Usuario"),
        avatar_key: avatarById.get(String(member.id ?? "").trim()) || (member.avatar_key ? String(member.avatar_key) : null),
        social_platform: member.social_platform ? String(member.social_platform) : null,
        social_handle: member.social_handle ? String(member.social_handle) : null,
        rol_lug: member.rol_lug ? String(member.rol_lug) : null,
      }))
      .filter((member) => member.id);

    setMiLugMembersRows(members);
    setMiLugMembersLoading(false);
  }

  async function openMiLugMembersPanel() {
    await loadMiLugMembersList({ openPanel: true });
  }

  async function promoteMiLugMemberToAdmin(memberId: string, memberName: string) {
    if (!supabase || !currentLugId) {
      return;
    }

    setPromoteMemberLoadingId(memberId);

    const { error } = await supabase.rpc("promote_lug_member_to_admin", {
      target_lug_id: currentLugId,
      target_member_id: memberId,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setPromoteMemberLoadingId(null);
      return;
    }

    setStatus(`${memberName} ahora es admin del LUG.`);
    await openMiLugMembersPanel();
    setPromoteMemberLoadingId(null);
  }

  async function openMiLugMemberChat(memberId: string, memberName: string) {
    if (!supabase || !userId) {
      return;
    }

    if (!memberId || memberId === userId) {
      setStatus("No se puede crear un chat grupal con tu propio usuario.");
      return;
    }

    setMemberChatLoadingId(memberId);

    let roomId = "";
    const { data: roomsData, error: roomsError } = await supabase.rpc("chat_list_rooms_current", { p_limit: 500 });
    if (!roomsError) {
      const maybeRoom = ((roomsData ?? []) as Array<Record<string, unknown>>).find((row) => {
        const roomType = String(row.room_type ?? "").trim();
        if (roomType !== "group") {
          return false;
        }
        const participants = Array.isArray((row as { participant_ids?: unknown }).participant_ids)
          ? ((row as { participant_ids?: unknown[] }).participant_ids ?? []).map((value) => String(value ?? "").trim()).filter(Boolean)
          : [];
        if (participants.length !== 2) {
          return false;
        }
        return participants.includes(userId) && participants.includes(memberId);
      });

      roomId = String((maybeRoom as { room_id?: unknown } | undefined)?.room_id ?? "").trim();
    }

    if (!roomId) {
      const roomName = `Chat ${displayName || "Usuario"} + ${memberName || "Usuario"}`;
      const { data, error } = await supabase.rpc("chat_create_group_room", {
        p_name: roomName,
        p_member_ids: [memberId],
      });

      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
        setMemberChatLoadingId(null);
        return;
      }

      roomId = String(data ?? "").trim();
    }

    if (!roomId) {
      setStatus("No se pudo abrir el chat.");
      setMemberChatLoadingId(null);
      return;
    }

    await openChatPopupByRoomId(roomId, memberName || "Usuario");
    setMemberChatLoadingId(null);
  }

  async function openChatPopupByRoomId(roomId: string, roomLabel: string) {
    if (!supabase || !roomId) {
      return;
    }

    setSelectedMemberChat({ roomId, memberId: "", memberName: roomLabel || "Chat" });
    setShowMemberChatPopup(true);
    setShowMiLugMembersPanel(false);
    setShowUnreadChatsPopup(false);
    setMemberChatMessages([]);
    setMemberChatLoading(true);

    const { data: messageRows, error: messagesError } = await supabase
      .from("chat_messages")
      .select("message_id, room_id, sender_id, content, created_at, edited_at")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(120);

    if (messagesError) {
      setStatus(`${t.errorPrefix}: ${messagesError.message}`);
      setMemberChatLoading(false);
      return;
    }

    const parsedMessages: MemberChatMessageItem[] = ((messageRows ?? []) as Array<Record<string, unknown>>)
      .map((row) => ({
        message_id: String(row.message_id ?? "").trim(),
        room_id: String(row.room_id ?? "").trim(),
        sender_id: (() => {
          const value = String(row.sender_id ?? "").trim();
          return value || null;
        })(),
        content: String(row.content ?? ""),
        created_at: String(row.created_at ?? "").trim(),
        edited_at: (() => {
          const value = String(row.edited_at ?? "").trim();
          return value || null;
        })(),
      }))
      .filter((row) => row.message_id);

    setMemberChatMessages(parsedMessages);

    const latestMessageId = parsedMessages[parsedMessages.length - 1]?.message_id ?? null;
    if (latestMessageId) {
      await supabase.rpc("chat_mark_room_read", {
        p_room_id: roomId,
        p_last_message_id: latestMessageId,
      });
      void loadUnreadChatsCount();
    }

    setMemberChatLoading(false);
  }

  async function sendMessageInMemberChat() {
    if (!supabase || !userId || !selectedMemberChat || memberChatSending) {
      return;
    }

    const content = memberChatInput.trim();
    if (!content) {
      return;
    }

    setMemberChatSending(true);

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: selectedMemberChat.roomId,
        sender_id: userId,
        message_type: "text",
        content,
      })
      .select("message_id, room_id, sender_id, content, created_at, edited_at")
      .single();

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setMemberChatSending(false);
      return;
    }

    if (data) {
      const sentMessage: MemberChatMessageItem = {
        message_id: String((data as { message_id?: unknown }).message_id ?? "").trim(),
        room_id: String((data as { room_id?: unknown }).room_id ?? "").trim(),
        sender_id: (() => {
          const value = String((data as { sender_id?: unknown }).sender_id ?? "").trim();
          return value || null;
        })(),
        content: String((data as { content?: unknown }).content ?? content),
        created_at: String((data as { created_at?: unknown }).created_at ?? "").trim(),
        edited_at: (() => {
          const value = String((data as { edited_at?: unknown }).edited_at ?? "").trim();
          return value || null;
        })(),
      };
      if (sentMessage.message_id) {
        setMemberChatMessages((prev) => {
          if (prev.some((message) => message.message_id === sentMessage.message_id)) {
            return prev;
          }
          return [...prev, sentMessage];
        });
      }
    }

    setMemberChatInput("");
    setMemberChatSending(false);
  }

  async function resolveMasterEmptyLug(notificationId: string, actionValue: "delete" | "open") {
    if (!supabase) {
      return;
    }

    setMasterLugActionLoadingId(notificationId);

    const { error } = await supabase.rpc("resolve_empty_lug_notification", {
      target_notification_id: notificationId,
      action_value: actionValue,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setMasterLugActionLoadingId(null);
      return;
    }

    await loadMasterEmptyNotificationsCount();
    await loadMasterEmptyNotificationsList();
    await loadMasterLugs();

    setMasterLugActionLoadingId(null);
    setStatus(actionValue === "delete" ? "LUG eliminado." : "LUG abierto para ingreso directo.");
  }

  async function joinOpenLugDirectly(lugId: string, lugName: string) {
    if (!supabase || !userId) {
      return;
    }

    setRequestActionLoadingLugId(lugId);

    const { error } = await supabase
      .from("profiles")
      .update({
        current_lug_id: lugId,
        rol_lug: "common",
      })
      .eq("id", userId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setRequestActionLoadingLugId(null);
      return;
    }

    await supabase
      .from("lug_join_requests")
      .update({ status: "cancelled" })
      .eq("requester_id", userId)
      .eq("status", "pending");

    await supabase
      .from("lugs")
      .update({ open_access: false })
      .eq("lug_id", lugId)
      .eq("open_access", true);

    setCurrentLugId(lugId);
    setSettingsLugId(lugId);
    setRolLug("common");
    await loadCurrentLugPalette(lugId);
    await loadMyJoinRequests(userId);
    await loadMasterLugs();
    setRequestActionLoadingLugId(null);
    setStatus(`Ingresaste directo a ${lugName}.`);
  }

  function canDirectJoinLug(lug: MasterLugItem) {
    return Boolean(lug.open_access) && Number(lug.members_count ?? 0) === 0;
  }

  async function deleteOpenLugFromMaster(lugId: string, lugName: string) {
    if (!supabase) {
      return;
    }

    setMasterLugActionLoadingId(lugId);

    const { error } = await supabase
      .from("lugs")
      .delete()
      .eq("lug_id", lugId)
      .eq("open_access", true);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setMasterLugActionLoadingId(null);
      return;
    }

    await loadMasterLugs();
    if (isMaster) {
      await loadMasterEmptyNotificationsCount();
      if (showMasterEmptyLugsPanel) {
        await loadMasterEmptyNotificationsList();
      }
    }
    if (currentLugId === lugId) {
      setCurrentLugId(null);
      setSettingsLugId(null);
      setRolLug(null);
    }

    setMasterLugActionLoadingId(null);
    setStatus(`LUG abierto eliminado: ${lugName}.`);
  }

  function startLugAccessAction(lug: MasterLugItem) {
    const nextType: PendingLugAccessAction["type"] = canDirectJoinLug(lug) ? "direct" : "request";

    if (currentLugId && currentLugId !== lug.lug_id) {
      setPendingLugAccessAction({
        type: nextType,
        lug_id: lug.lug_id,
        lug_name: lug.nombre,
      });
      setShowLugAccessConfirmPanel(true);
      return;
    }

    if (nextType === "direct") {
      void joinOpenLugDirectly(lug.lug_id, lug.nombre);
      return;
    }

    openJoinRequestForm(lug.lug_id, lug.nombre);
  }

  function confirmLugAccessAction() {
    if (!pendingLugAccessAction) {
      return;
    }

    if (pendingLugAccessAction.type === "direct") {
      void joinOpenLugDirectly(pendingLugAccessAction.lug_id, pendingLugAccessAction.lug_name);
    } else {
      openJoinRequestForm(pendingLugAccessAction.lug_id, pendingLugAccessAction.lug_name);
    }

    setShowLugAccessConfirmPanel(false);
    setPendingLugAccessAction(null);
  }

  function openAdminRequestDetail(request: AdminJoinRequestItem) {
    setSelectedAdminRequest(request);
    setShowAdminRequestDetailPanel(true);
  }

  async function resolveAdminRequest(decision: "accepted" | "rejected") {
    if (!supabase || !selectedAdminRequest) {
      return;
    }

    setAdminDecisionLoading(true);

    const { error } = await supabase.rpc("resolve_lug_join_request", {
      target_request_id: selectedAdminRequest.request_id,
      decision_value: decision,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setAdminDecisionLoading(false);
      return;
    }

    if (currentLugId) {
      await loadAdminPendingRequestsCount(currentLugId);
      await loadAdminPendingRequestsList(currentLugId);
      await loadMasterLugs();
    }

    setAdminDecisionLoading(false);
    setShowAdminRequestDetailPanel(false);
    setSelectedAdminRequest(null);
    setStatus(decision === "accepted" ? "Solicitud aceptada." : "Solicitud rechazada.");
  }

  async function promoteMemberToAdmin(memberId: string, memberName: string) {
    if (!supabase || !lugInfoData) {
      return;
    }

    setPromoteMemberLoadingId(memberId);

    const { error } = await supabase.rpc("promote_lug_member_to_admin", {
      target_lug_id: lugInfoData.lug_id,
      target_member_id: memberId,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setPromoteMemberLoadingId(null);
      return;
    }

    setStatus(`${memberName} ahora es admin del LUG.`);
    await openLugInfoPanel(lugInfoData.lug_id);
    setPromoteMemberLoadingId(null);
  }

  async function openLugInfoPanel(lugId: string) {
    if (!supabase) {
      return;
    }

    setShowLugInfoPanel(true);
    setLugInfoLoading(true);

    const { data: lugData, error: lugError } = await supabase
      .from("lugs")
      .select("lug_id, nombre, pais, descripcion, color1, logo_data_url")
      .eq("lug_id", lugId)
      .maybeSingle();

    if (lugError || !lugData) {
      setStatus(`${t.errorPrefix}: ${lugError?.message ?? "No pudimos cargar el LUG."}`);
      setLugInfoData(null);
      setLugInfoLoading(false);
      return;
    }

    const { data: membersData, error: membersError } = await supabase.rpc("get_lug_members_current", {
      target_lug_id: lugId,
    });

    if (membersError) {
      setStatus(`${t.errorPrefix}: ${membersError.message}`);
    }

    const membersRows = (membersData ?? []) as Array<Record<string, unknown>>;
    const memberIds = membersRows.map((member) => String(member.id ?? "").trim()).filter(Boolean);
    const avatarById = await fetchProfileAvatarsByIds(memberIds);
    const members = membersRows.map((member) => ({
      id: String(member.id),
      full_name: String(member.full_name ?? "Usuario"),
      avatar_key: avatarById.get(String(member.id ?? "").trim()) || (member.avatar_key ? String(member.avatar_key) : null),
      social_platform: member.social_platform ? String(member.social_platform) : null,
      social_handle: member.social_handle ? String(member.social_handle) : null,
      rol_lug: member.rol_lug ? String(member.rol_lug) : null,
    }));

    setLugInfoData({
      lug_id: String(lugData.lug_id),
      nombre: String(lugData.nombre ?? ""),
      pais: lugData.pais ? String(lugData.pais) : null,
      descripcion: lugData.descripcion ? String(lugData.descripcion) : null,
      logo_data_url: lugData.logo_data_url ? String(lugData.logo_data_url) : null,
      color1: lugData.color1 ? String(lugData.color1) : null,
      members,
    });

    setLugInfoLoading(false);
  }

  async function handleSettingsLugLogoFileChange(file: File | null) {
    setSettingsLugLogoError("");

    if (!file) {
      setSettingsLugLogoDataUrl(null);
      setSettingsLugLogoFile(null);
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });

    await new Promise<void>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        if (img.width > 500 || img.height > 500) {
          setSettingsLugLogoError("La imagen debe ser maximo 500x500 px.");
          setSettingsLugLogoDataUrl(null);
          setSettingsLugLogoFile(null);
        } else {
          setSettingsLugLogoDataUrl(dataUrl);
          setSettingsLugLogoFile(file);
        }
        resolve();
      };
      img.onerror = () => {
        setSettingsLugLogoError("No pudimos leer la imagen.");
        setSettingsLugLogoDataUrl(null);
        setSettingsLugLogoFile(null);
        resolve();
      };
      img.src = dataUrl;
    });
  }

  async function openSettingsLugPanel() {
    if (!supabase || !settingsLugId) {
      setStatus(statusText.userHasNoLug);
      return;
    }

    setSettingsLugPanelLoading(true);
    setShowSettingsLugPanel(true);
    setSettingsLugLogoError("");

    const { data, error } = await supabase
      .from("lugs")
      .select("lug_id, nombre, pais, descripcion, color1, color2, color3, logo_data_url")
      .eq("lug_id", settingsLugId)
      .maybeSingle();

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setSettingsLugPanelLoading(false);
      return;
    }

    setSettingsLugNombreInput(String(data?.nombre ?? ""));
    setSettingsLugPaisInput(String(data?.pais ?? ""));
    setSettingsLugDescripcionInput(String(data?.descripcion ?? ""));
    setSettingsLugColor1Input(String(data?.color1 ?? "#006eb2"));
    setSettingsLugColor2Input(String(data?.color2 ?? "#ffffff"));
    setSettingsLugColor3Input(String(data?.color3 ?? "#111111"));
    setSettingsLugLogoDataUrl(data?.logo_data_url ? String(data.logo_data_url) : null);
    setSettingsLugLogoFile(null);

    setSettingsLugPanelLoading(false);
  }

  async function saveSettingsLugPanel() {
    if (!supabase || !settingsLugId) {
      return;
    }

    if (rolLug !== "admin") {
      setStatus(statusText.onlyAdminCanEditLug);
      return;
    }

    setSettingsLugSaving(true);

    let nextSettingsLogoUrl = settingsLugLogoDataUrl;
    if (settingsLugLogoFile) {
      const uploadedLogoUrl = await uploadLugLogoFile(settingsLugId, settingsLugLogoFile);
      if (uploadedLogoUrl) {
        nextSettingsLogoUrl = uploadedLogoUrl;
      }
    }

    const { error } = await supabase
      .from("lugs")
      .update({
        nombre: settingsLugNombreInput.trim(),
        pais: settingsLugPaisInput.trim() || null,
        descripcion: settingsLugDescripcionInput.trim() || null,
        color1: settingsLugColor1Input.trim() || null,
        color2: settingsLugColor2Input.trim() || null,
        color3: settingsLugColor3Input.trim() || null,
        logo_data_url: nextSettingsLogoUrl,
      })
      .eq("lug_id", settingsLugId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setSettingsLugSaving(false);
      return;
    }

    setSettingsLugName(settingsLugNombreInput.trim() || settingsLugName);
    await loadMasterLugs();
    if (currentLugId === settingsLugId) {
      await loadCurrentLugPalette(settingsLugId);
    }
    setSettingsLugSaving(false);
    setShowSettingsLugPanel(false);
    setStatus(statusText.lugInfoUpdated);
  }

  const loadMasterLugs = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setMasterLugsLoading(true);

    const lugsResult = await supabase
      .from("lugs")
      .select("lug_id, nombre, pais, color1, open_access, logo_data_url")
      .order("created_at", { ascending: false });

    let lugsData = lugsResult.data;
    let lugsError = lugsResult.error;

    if (lugsError) {
      const fallbackLugs = await supabase
        .from("lugs")
        .select("lug_id, nombre, pais, color1, open_access")
        .order("created_at", { ascending: false });

      if (!fallbackLugs.error) {
        lugsData = (fallbackLugs.data ?? []).map((row) => ({
          ...row,
          logo_data_url: null,
        }));
        lugsError = null;
      }
    }

    if (lugsError) {
      setStatus(`${t.errorPrefix}: ${lugsError.message}`);
      setMasterLugs([]);
      setMasterLugsLoading(false);
      return;
    }

    const countsResult = await supabase.rpc("get_lug_member_counts_current");

    if (countsResult.error) {
      setStatus(statusText.lugMemberCountFailed);
    }

    const countRows = (countsResult.data ?? []) as Array<Record<string, unknown>>;
    const counts = countRows.reduce((acc: Record<string, number>, row) => {
      const key = String(row.lug_id ?? "").trim();
      if (!key) {
        return acc;
      }
      const value = Number(row.members_count ?? 0);
      acc[key] = Number.isFinite(value) ? value : 0;
      return acc;
    }, {});

    const parsed = (lugsData ?? []).map((lug) => ({
      lug_id: String(lug.lug_id),
      nombre: String(lug.nombre ?? ""),
      pais: lug.pais ? String(lug.pais) : null,
      color1: lug.color1 ? String(lug.color1) : null,
      open_access: Boolean(lug.open_access),
      logo_data_url: lug.logo_data_url ? String(lug.logo_data_url) : null,
      members_count: counts[String(lug.lug_id)] ?? 0,
    }));

    setMasterLugs(parsed);
    setMasterLugsLoading(false);
  }, [statusText.lugMemberCountFailed, supabase, t.errorPrefix]);

  useEffect(() => {
    if (!mustSelectLugOnDashboard) {
      return;
    }

    setShowLugsPanel(true);
    void loadMasterLugs();
  }, [loadMasterLugs, mustSelectLugOnDashboard]);

  if (maintenanceEnabled && !isMaster) {
    return (
      <main className="bg-lego-tile min-h-screen">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4">
            <Image
              src="/api/avatar/Constructor.png"
              alt="Constructor"
              width={220}
              height={220}
              unoptimized
              className="h-[220px] w-[220px] object-contain"
            />
            <div className="space-y-2 text-center">
              <p className="font-cubano-title text-3xl font-semibold text-white">{maintenanceMessageLine1}</p>
              <p className="font-cubano-title text-2xl font-semibold text-white">{maintenanceMessageLine2}</p>
            </div>
          </div>
          <div className="mt-6 w-full px-4 text-center">
            <p className="mx-auto inline-block px-4 py-1 text-xs font-semibold tracking-wide" style={{ color: "#a8a8a8" }}>
              {footerLegend || "LUGs App"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (appBootLoading && supabase) {
    return (
      <main className="bg-lego-tile min-h-screen">
        <div className="flex min-h-screen items-center justify-center">
          <p className="font-cubano-title text-3xl font-semibold text-white">{loadingPhrase}</p>
        </div>
      </main>
    );
  }

  const unreadChatsFloatingAlert = unreadChatsCount > 0 ? (
    <button
      type="button"
      onClick={() => void openUnreadChatsPanel()}
      className="absolute right-2 top-2 z-[80] rounded-lg border border-slate-300 bg-white/95 p-1.5 shadow"
      title={`Tenes ${unreadChatsCount} mensajes sin leer`}
    >
      <div className="relative">
        <Image
          src="/api/avatar/Mensaje_1x1.svg"
          alt="Mensajes sin leer"
          width={28}
          height={28}
          unoptimized
          className="h-[28px] w-[28px] object-contain"
        />
        <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {unreadChatsCount > 99 ? "99+" : unreadChatsCount}
        </span>
      </div>
    </button>
  ) : null;

  const unreadChatsPopupOverlay = showUnreadChatsPopup ? (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowUnreadChatsPopup(false)}>
      <div className="w-full max-w-[460px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-boogaloo text-2xl text-slate-900">Chats</h3>
          <button
            type="button"
            onClick={() => setShowUnreadChatsPopup(false)}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
          >
            {labels.close}
          </button>
        </div>

        <div className="mt-3 max-h-[360px] space-y-2 overflow-auto">
          {unreadChatsPopupLoading ? (
            <p className="text-sm text-slate-600">{labels.loading}</p>
          ) : unreadChatsRooms.length === 0 ? (
            <p className="text-sm text-slate-500">No hay conversaciones.</p>
          ) : (
            unreadChatsRooms.map((room) => {
              const hasUnread = room.unread_count > 0;
              const title = (() => {
                if (room.peer_user_id) {
                  const resolved = unreadChatNameByUserId[room.peer_user_id];
                  if (resolved) {
                    return resolved;
                  }
                }

                const cleanedRoomName = String(room.room_name ?? "").replace(/^chat\s+/i, "").trim();
                if (cleanedRoomName.includes("+")) {
                  const displayNameNormalized = String(displayName ?? "").trim().toLowerCase();
                  const parts = cleanedRoomName.split("+").map((part) => part.trim()).filter(Boolean);
                  if (parts.length > 0) {
                    const otherPart = parts.find((part) => part.toLowerCase() !== displayNameNormalized);
                    if (otherPart) {
                      return otherPart;
                    }
                    return parts[0];
                  }
                }

                if (cleanedRoomName) {
                  return cleanedRoomName;
                }

                return room.room_name || (room.room_type === "direct" ? "Chat directo" : "Grupo");
              })();
              const preview = room.last_message_content || "Sin mensajes";
              return (
                <button
                  key={room.room_id}
                  type="button"
                  onClick={() => void openChatPopupByRoomId(room.room_id, title)}
                  className={`w-full rounded-md border px-3 py-2 text-left ${
                    hasUnread ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
                    {hasUnread ? (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {room.unread_count > 99 ? "99+" : room.unread_count}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-600">{preview}</p>
                  {room.last_message_at ? (
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(room.last_message_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  ) : null;

  const memberChatPopupOverlay = showMemberChatPopup && selectedMemberChat ? (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/55 p-4"
      onClick={() => {
        setShowMemberChatPopup(false);
        setSelectedMemberChat(null);
        setMemberChatMessages([]);
        setMemberChatInput("");
      }}
    >
      <div className="w-full max-w-[760px] rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="font-boogaloo text-2xl text-slate-900">Chat</p>
            <p className="text-xs text-slate-600">{selectedMemberChat.memberName}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowMemberChatPopup(false);
              setSelectedMemberChat(null);
              setMemberChatMessages([]);
              setMemberChatInput("");
            }}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
          >
            Cerrar
          </button>
        </header>

        <div ref={memberChatScrollRef} className="max-h-[430px] min-h-[300px] overflow-y-auto bg-slate-50 px-4 py-3">
          {memberChatLoading ? <p className="text-sm text-slate-500">{labels.loading}</p> : null}
          {!memberChatLoading && memberChatMessages.length === 0 ? <p className="text-sm text-slate-500">Sin mensajes todavia.</p> : null}
          <div className="space-y-2">
            {memberChatMessages.map((message) => {
              const isMine = message.sender_id === userId;
              return (
                <div key={message.message_id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg border px-3 py-2 ${isMine ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"}`}>
                    <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                    <p className={`mt-1 text-[10px] ${isMine ? "text-white/70" : "text-slate-400"}`}>
                      {new Date(message.created_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="border-t border-slate-200 p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={memberChatInput}
              onChange={(event) => setMemberChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessageInMemberChat();
                }
              }}
              placeholder="Escribe un mensaje..."
              className="max-h-24 min-h-[40px] flex-1 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <button
              type="button"
              onClick={() => void sendMessageInMemberChat()}
              disabled={memberChatSending || !memberChatInput.trim()}
              className="rounded-md border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Enviar
            </button>
          </div>
        </footer>
      </div>
    </div>
  ) : null;

  const deleteUserConfirmPopupOverlay = showDeleteUserConfirmPopup ? (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !deletingUserAccount && setShowDeleteUserConfirmPopup(false)}>
      <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <p className="font-boogaloo text-2xl text-slate-900">Desarmar usuario</p>
        <p className="mt-2 text-sm text-slate-700">Esta accion elimina tu cuenta y tus datos (listas y registros). Los mensajes de chat quedaran solo como texto.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowDeleteUserConfirmPopup(false)}
            disabled={deletingUserAccount}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm"
          >
            No
          </button>
          <button
            type="button"
            onClick={() => void deleteCurrentUserAccount()}
            disabled={deletingUserAccount}
            className="rounded-md border border-red-400 bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {deletingUserAccount ? "Desarmando..." : "Si"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (userEmail) {
    if (activeSection === "lista_detalle" && !selectedListForItems) {
      return (
        <main className="bg-lego-tile min-h-screen">
          {unreadChatsFloatingAlert}
          {unreadChatsPopupOverlay}
          {memberChatPopupOverlay}
          {deleteUserConfirmPopupOverlay}
          <div className="flex min-h-screen flex-col items-center justify-center">
            <p className="font-cubano-title text-3xl font-semibold text-white">{labels.loadingList}</p>
            <div className="mt-6 w-full px-4 text-center">
              <p className="mx-auto inline-block px-4 py-1 text-xs font-semibold tracking-wide" style={{ color: "#a8a8a8" }}>
                {footerLegend || "LUGs App"}
              </p>
            </div>
          </div>
        </main>
      );
    }

    if (activeSection === "lista_detalle" && selectedListForItems) {
      const listTypeLabel = selectedListForItems.tipo === "deseos" ? labels.wishlistListType : labels.saleListType;
      const visibilityLabel = selectedListForItems.visibilidad === "publico" ? labels.public : labels.private;
      const totalLotes = listItemsRows.length;
      const totalPiezas = listItemsRows.reduce((acc, row) => acc + Math.max(0, Number(row.quantity) || 0), 0);

      return (
        <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
          <div className="relative mx-auto w-full max-w-[900px] rounded-2xl border-[10px] p-[1px] shadow-xl" style={{ borderColor: uiColor1 }}>
            {unreadChatsFloatingAlert}
            {unreadChatsPopupOverlay}
            {memberChatPopupOverlay}
            {deleteUserConfirmPopupOverlay}
            <div className="rounded-xl border-[5px] bg-white p-4 sm:p-8" style={{ borderColor: currentLugColor2 || "#ffffff", backgroundColor: "#ffffff" }}>
              <header>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-boogaloo text-3xl font-semibold text-slate-900">{`${listTypeLabel} ${selectedListForItems.nombre}`}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      void openListasSection();
                    }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    {labels.back}
                  </button>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">{visibilityLabel}</p>
                <p className="mt-1 text-sm text-slate-600">{`${labels.listLotsCount}: ${totalLotes} - ${labels.listPiecesCount}: ${totalPiezas}`}</p>
                <div className="mt-3 h-[5px] w-full rounded-full" style={{ backgroundColor: currentLugColor2 || "#ffffff" }} />
              </header>

              <section className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-boogaloo text-2xl font-semibold text-slate-900">{labels.addItem}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoriesPanelMode("categories");
                      setCategoryQuickFilter("popular");
                      setSelectedPanelCategory(null);
                      setShowCategoriesPanel(true);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                  >
                    {labels.categories}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-[72px_minmax(0,1fr)] grid-rows-2 gap-2 sm:grid-cols-[84px_minmax(0,1fr)]">
                  <div className="relative row-span-2 flex h-[84px] w-[72px] items-center justify-center overflow-hidden rounded-md border border-slate-300 bg-white sm:w-[84px]">
                    {selectedPartPreviewImage ? (
                      <Image
                        src={selectedPartPreviewImage}
                        alt={selectedSearchPart?.name ?? "pieza"}
                        width={56}
                        height={56}
                        unoptimized
                        className="h-[72px] w-[72px] object-contain"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400">{labels.noImage}</span>
                    )}
                    {showGenericColorImageWarning ? (
                      <span
                        className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center"
                        title="Imagen de pieza generica, no hay imagen en el color elegido"
                      >
                        <Image
                          src="/api/avatar/Exclamacion.svg"
                          alt="Advertencia"
                          width={16}
                          height={16}
                          unoptimized
                          className="h-4 w-4 object-contain"
                        />
                      </span>
                    ) : null}
                  </div>
                  <div ref={partSearchDropdownRef} className="relative">
                    <input
                      type="text"
                      value={partsSearchQuery}
                      onChange={(event) => {
                        const next = event.target.value;
                        setPartsSearchQuery(next);
                        const currentLabel = selectedSearchPart ? formatPartLabel(selectedSearchPart) : "";
                        if (next !== currentLabel) {
                          setSelectedSearchPartNum(null);
                          setSelectedPartColorImageUrl(null);
                          setSelectedPartColorImageMissing(false);
                        }
                      }}
                      onFocus={() => {
                        if (partsSearchResults.length > 0 && partsSearchQuery.trim().length >= 3) {
                          setShowPartSearchDropdown(true);
                        }
                      }}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder={labels.searchPlaceholder}
                    />
                    {partsSearchLoading ? <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">{labels.searching}</span> : null}
                    {showPartSearchDropdown ? (
                      <div className="absolute left-0 top-[calc(100%+4px)] z-20 max-h-52 w-full overflow-auto rounded-md border border-slate-300 bg-white p-1 shadow-lg">
                        {partsSearchResults.length === 0 ? (
                          <p className="px-2 py-1 text-xs text-slate-500">{labels.noResults}</p>
                        ) : (
                          partsSearchResults.map((part) => (
                            <button
                              key={`search-${part.part_num}`}
                              type="button"
                              onClick={() => selectPartForAddItem(part, { closeCatalog: false })}
                              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-slate-100"
                            >
                              <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white">
                                {part.part_img_url ? (
                                  <Image
                                    src={part.part_img_url}
                                    alt={part.name}
                                    width={24}
                                    height={24}
                                    unoptimized
                                    className="h-6 w-6 object-contain"
                                  />
                                ) : null}
                              </span>
                              <span className="text-xs font-semibold text-slate-800">{part.part_num}</span>
                              <span className="truncate text-xs text-slate-600">{part.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,320px)_auto_140px] sm:items-center">
                    <div ref={colorDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setShowColorDropdown((prev) => !prev)}
                        className="flex w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 pr-[136px] text-left text-sm"
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-sm border border-slate-300"
                          style={{ backgroundColor: selectedColorHex ? `#${selectedColorHex}` : "#ffffff" }}
                        />
                        <span className="truncate">{addItemColorDisplayLabel}</span>
                      </button>
                      {showColorDropdown ? (
                        <div className="absolute left-0 top-[calc(100%+4px)] z-20 max-h-52 w-full overflow-auto rounded-md border border-slate-300 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setAddItemColorNameInput(NO_COLOR_LABEL);
                              setSelectedPartColorImageUrl(null);
                              setSelectedPartColorImageMissing(false);
                              setShowColorDropdown(false);
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-100"
                          >
                            <span className="h-3.5 w-3.5 rounded-sm border border-slate-300 bg-white" />
                            <span className="truncate">{labels.noColor}</span>
                          </button>
                          {visibleColorOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setAddItemColorNameInput(option.label);
                                setSelectedPartColorImageMissing(false);
                                setShowColorDropdown(false);
                              }}
                              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-100"
                            >
                              <span
                                className="h-3.5 w-3.5 rounded-sm border border-slate-300"
                                style={{ backgroundColor: option.hex ? `#${option.hex}` : "#ffffff" }}
                              />
                              <span className="truncate">{option.label}</span>
                              {!option.lego_available ? <span className="text-[10px] text-slate-500">{labels.notLegoColor}</span> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAddItemColorMode("bricklink")}
                          className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                            addItemColorMode === "bricklink" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                          }`}
                        >
                          BrickLink
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddItemColorMode("lego")}
                          className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                            addItemColorMode === "lego" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                          }`}
                        >
                          LEGO
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={addItemColorExists}
                        onChange={(event) => {
                          const next = event.target.checked;
                          setAddItemColorExists(next);
                          setShowColorDropdown(false);
                          if (!next) {
                            setPartAvailableColorNames([]);
                          }
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <span>{labels.existingColorPart}</span>
                    </label>

                    <div className="flex items-center overflow-hidden rounded-md border border-slate-300 bg-white">
                      <button
                        type="button"
                        onClick={() => setAddItemQuantity((prev) => Math.max(1, prev - 1))}
                        className="h-full px-3 text-base font-semibold text-slate-700"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={addItemQuantity}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          setAddItemQuantity(Number.isFinite(next) && next > 0 ? Math.floor(next) : 1);
                        }}
                        className="w-full border-x border-slate-300 px-2 py-2 text-center text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setAddItemQuantity((prev) => prev + 1)}
                        className="h-full px-3 text-base font-semibold text-slate-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {selectedListForItems?.tipo === "venta" ? (
                  <div className="mt-2 ml-[74px] sm:ml-[86px]">
                    <label className="mb-1 block text-xs font-semibold text-slate-700">{labels.price}</label>
                    <div className="flex w-full max-w-[220px] items-center rounded-md border border-slate-300 bg-white px-2 py-1.5">
                      <span className="text-sm font-semibold text-slate-700">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={addItemPriceInput}
                        onChange={(event) => setAddItemPriceInput(event.target.value)}
                        className="w-full bg-transparent px-2 text-sm outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void addSelectedPartToList()}
                    disabled={!selectedSearchPart}
                    className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    style={{ backgroundColor: uiColor1, color: uiColor1Text }}
                  >
                    {labels.addItem}
                  </button>
                </div>

              </section>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void openPdfExportPrint()}
                  className="w-full rounded-md px-4 py-2 text-sm font-semibold"
                  style={{ backgroundColor: uiColor1, color: uiColor1Text }}
                >
                  {labels.exportPdf}
                </button>
              </div>

              <div className="mt-3">
                <div className="rounded-md border border-slate-200 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-boogaloo text-2xl font-semibold tracking-wide text-slate-900">{labels.itemsOfList}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setListItemsPage((prev) => Math.max(1, prev - 1))}
                        disabled={listItemsCurrentPage <= 1}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                      >
                        ←
                      </button>
                      <p className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700">{`${listItemsCurrentPage} / ${listItemsMaxPage}`}</p>
                      <button
                        type="button"
                        onClick={() => setListItemsPage((prev) => Math.min(listItemsMaxPage, prev + 1))}
                        disabled={listItemsCurrentPage >= listItemsMaxPage}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {listItemsRows.length === 0 ? (
                      <p className="text-sm text-slate-500">{labels.listHasNoPartsYet}</p>
                    ) : (
                      listItemsVisibleRows.map((row) => (
                        <div key={row.item_id} className="rounded-md border border-slate-200 px-2 py-2">
                          <div className="flex items-start gap-2">
                            <div
                              className={`relative flex h-[64px] w-[64px] items-center justify-center overflow-hidden rounded-md border bg-white ${
                                row.imgmatchcolor ? "border-slate-300" : "border-2 border-red-500"
                              }`}
                            >
                              {row.part_img_url ? (
                                <Image
                                  src={row.part_img_url}
                                  alt={row.part_name || row.part_num || "pieza"}
                                  width={56}
                                  height={56}
                                  unoptimized
                                  className="h-[56px] w-[56px] object-contain"
                                />
                              ) : (
                                <span className="text-[10px] text-slate-400">{labels.noImage}</span>
                              )}
                              {!row.imgmatchcolor ? (
                                <span
                                  className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center"
                                  title="Imagen de pieza generica, no hay imagen en el color elegido"
                                >
                                  <Image
                                    src="/api/avatar/Exclamacion.svg"
                                    alt="Advertencia"
                                    width={16}
                                    height={16}
                                    unoptimized
                                    className="h-4 w-4 object-contain"
                                  />
                                </span>
                              ) : null}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate text-xs font-semibold text-slate-900">{`${row.part_num || "-"} - ${row.part_name || labels.noNameFallback}`}</p>
                                {selectedListForItems?.nombre !== AUTO_MINIFIG_MISSING_LIST_NAME ? (
                                  <button
                                    type="button"
                                    onClick={() => void deleteListItem(row.item_id)}
                                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                                    title="Eliminar lote"
                                  >
                                    🗑
                                  </button>
                                ) : null}
                              </div>

                              <div className="mt-2 flex items-center gap-2">
                                <span
                                  className="inline-flex max-w-[220px] items-center truncate rounded-md border px-2 py-1 text-[11px] font-semibold"
                                  style={(() => {
                                    const hex = row.display_color_label ? colorHexByLabel.get(normalizeColorLabel(row.display_color_label)) : null;
                                    const bg = hex ? `#${hex}` : "#f8fafc";
                                    return {
                                      backgroundColor: bg,
                                      color: hex ? getContrastTextColor(bg) : "#334155",
                                      borderColor: hex ? "transparent" : "#cbd5e1",
                                    };
                                  })()}
                                >
                                  {row.display_color_label || NO_COLOR_LABEL}
                                </span>

                                <input
                                  type="number"
                                  min={1}
                                  value={itemQuantityInputs[row.item_id] ?? String(row.quantity)}
                                  onChange={(event) => {
                                    const raw = event.target.value;
                                    setItemQuantityInputs((prev) => ({ ...prev, [row.item_id]: raw }));
                                  }}
                                  onBlur={() => void saveListItemQuantity(row.item_id)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      void saveListItemQuantity(row.item_id);
                                    }
                                  }}
                                  className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs"
                                />

                                {selectedListForItems?.tipo === "venta" ? (
                                  <div className="flex items-center overflow-hidden rounded-md border border-emerald-300 bg-emerald-50">
                                    <span className="px-2 text-xs font-semibold text-emerald-800">$</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={itemPriceInputs[row.item_id] ?? (row.value == null ? "" : String(row.value))}
                                      onChange={(event) => {
                                        const raw = event.target.value;
                                        setItemPriceInputs((prev) => ({ ...prev, [row.item_id]: raw }));
                                      }}
                                      onBlur={() => void saveListItemPrice(row.item_id)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          void saveListItemPrice(row.item_id);
                                        }
                                      }}
                                      className="w-20 border-l border-emerald-300 bg-transparent px-2 py-1 text-xs text-emerald-900 outline-none"
                                      placeholder="0.00"
                                    />
                                  </div>
                                ) : null}

                                <div className="h-2 w-24 overflow-hidden rounded-full border border-slate-300 bg-slate-100">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.max(
                                        0,
                                        Math.min(
                                          100,
                                          Math.round(
                                            ((listItemOffersById[row.item_id] ?? []).reduce((acc, offer) => acc + Math.max(1, offer.quantity), 0) /
                                              Math.max(1, Number(row.quantity || 1))) *
                                              100,
                                          ),
                                        ),
                                      )}%`,
                                      backgroundColor: currentLugColor2 || "#ffffff",
                                    }}
                                  />
                                </div>

                                {(listItemOffersById[row.item_id]?.length ?? 0) > 0 ? (
                                  <div className="ml-auto flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const offers = listItemOffersById[row.item_id] ?? [];
                                        setSelectedListItemOffers({
                                          partLabel: `${row.part_num || "-"} - ${row.part_name || labels.noNameFallback}`,
                                          requestedQuantity: Math.max(1, Number(row.quantity || 1)),
                                          offers,
                                        });
                                      }}
                                      className="rounded-md px-2 py-1 text-xs font-semibold"
                                      style={{ backgroundColor: uiColor1, color: uiColor1Text }}
                                    >
                                      {labels.someoneOffersThisPart}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {selectedListItemOffers ? (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setSelectedListItemOffers(null)}>
              <div className="w-full max-w-md rounded-xl border border-slate-300 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                {(() => {
                  const offeredTotal = selectedListItemOffers.offers.reduce((acc, offer) => acc + Math.max(1, Number(offer.quantity || 1)), 0);
                  const requested = Math.max(1, Number(selectedListItemOffers.requestedQuantity || 1));
                  const progress = Math.max(0, Math.min(100, Math.round((offeredTotal / requested) * 100)));
                  const isComplete = progress >= 100;

                  return (
                    <>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-boogaloo text-xl text-slate-900">{labels.someoneOffersThisPart}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedListItemOffers(null)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                  >
                    {labels.close}
                  </button>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-800">{selectedListItemOffers.partLabel}</p>
                <div className="mt-3 space-y-2">
                  {selectedListItemOffers.offers.map((offer) => (
                    <p key={offer.offer_id} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      {labels.offerLine(offer.requester_name, offer.quantity)}
                    </p>
                  ))}
                </div>
                {!isComplete ? (
                  <div className="mt-3 w-full overflow-hidden rounded-md border border-slate-300 bg-slate-100">
                    <div
                      className="h-3 rounded-md"
                      style={{ width: `${progress}%`, backgroundColor: currentLugColor2 || "#ffffff" }}
                    />
                  </div>
                ) : (
                  <div className="mt-3 flex justify-center">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white">✓</span>
                  </div>
                )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : null}

          {showCategoriesPanel ? (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-4"
                onClick={() => {
                  setShowCategoriesPanel(false);
                  setCategoriesPanelMode("categories");
                  setCategoryQuickFilter("popular");
                  setSelectedPanelCategory(null);
                }}
            >
              <div className="w-full max-w-[700px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
                {categoriesPanelMode === "parts" && selectedPanelCategory ? (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCategoriesPanelMode("categories");
                            setSelectedPanelCategory(null);
                          }}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm font-semibold text-slate-700"
                          title={labels.backToCategories}
                        >
                          ←
                        </button>
                        <p className="font-boogaloo text-2xl text-slate-900">{selectedPanelCategory.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePanelPrintFilter("no_printed")}
                          className={`rounded-md border px-3 py-1 text-sm font-semibold ${
                            panelPrintFilters.no_printed ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                          }`}
                        >
                          {labels.notPrinted}
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePanelPrintFilter("printed")}
                          className={`rounded-md border px-3 py-1 text-sm font-semibold ${
                            panelPrintFilters.printed ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                          }`}
                        >
                          {labels.printed}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (panelCurrentPage > 1) {
                            setPanelPartsPage(panelCurrentPage - 1);
                          }
                        }}
                        disabled={panelCurrentPage <= 1}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        ←
                      </button>
                      <p className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700">{`${panelCurrentPage} / ${panelPartsMaxPage}`}</p>
                      <button
                        type="button"
                        onClick={() => {
                          const maxPage = panelPartsMaxPage;
                          if (panelCurrentPage < maxPage) {
                            setPanelPartsPage(panelCurrentPage + 1);
                          }
                        }}
                        disabled={panelCurrentPage >= panelPartsMaxPage}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCategoriesPanel(false);
                          setCategoriesPanelMode("categories");
                          setCategoryQuickFilter("popular");
                          setSelectedPanelCategory(null);
                        }}
                        className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                      >
                        {labels.close}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-boogaloo text-2xl text-slate-900">{labels.catalog}</p>
                      <button
                        type="button"
                        onClick={() => setCategoryQuickFilter("all")}
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          categoryQuickFilter === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                        }`}
                      >
                        {labels.filterAll}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryQuickFilter("popular")}
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          categoryQuickFilter === "popular" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                        }`}
                      >
                        {labels.filterPopular}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryQuickFilter("minifig")}
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          categoryQuickFilter === "minifig" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                        }`}
                      >
                        Minifig
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryQuickFilter("technic")}
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          categoryQuickFilter === "technic" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                        }`}
                      >
                        Technic
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryQuickFilter("otros")}
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          categoryQuickFilter === "otros" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                        }`}
                      >
                        {labels.filterOthers}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoriesPanel(false);
                        setCategoriesPanelMode("categories");
                        setCategoryQuickFilter("popular");
                        setSelectedPanelCategory(null);
                      }}
                      className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                    >
                      {labels.close}
                    </button>
                  </div>
                )}

                {categoriesPanelMode === "parts" && selectedPanelCategory ? (
                  <>
                    <div className="mt-3 rounded-md border border-slate-300 p-2">
                      {panelPartsLoading ? (
                        <p className="px-2 py-3 text-sm text-slate-500">{labels.loadingParts}</p>
                      ) : panelFilteredParts.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-slate-500">{labels.noPartsToShow}</p>
                      ) : (
                        <div className="grid grid-cols-5 gap-2">
                          {panelVisibleParts.map((part) => (
                            <div
                              key={part.part_num}
                              onDoubleClick={() => selectPartForAddItem(part)}
                              onClick={() => setSelectedPanelPartNum(part.part_num)}
                              className={`cursor-pointer rounded-md border p-2 hover:bg-slate-50 ${
                                selectedPanelPartNum === part.part_num ? "border-slate-900 bg-slate-50" : "border-slate-200"
                              }`}
                              title={labels.doubleClickSelect}
                            >
                              <div className="mx-auto h-16 w-16 overflow-hidden rounded border border-slate-200 bg-slate-50">
                                {part.part_img_url ? (
                                  <Image
                                    src={part.part_img_url}
                                    alt={part.name}
                                    width={64}
                                    height={64}
                                    unoptimized
                                    className="h-full w-full object-contain"
                                  />
                                ) : null}
                              </div>
                              <p className="mt-2 truncate text-[11px] font-semibold text-slate-900">{part.part_num}</p>
                              <p className="truncate text-[11px] text-slate-600">{part.name}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            const selected = panelVisibleParts.find((part) => part.part_num === selectedPanelPartNum);
                            if (selected) {
                              selectPartForAddItem(selected);
                            }
                          }}
                          disabled={!selectedPanelPartNum}
                          className="rounded-md px-6 py-2 text-lg font-semibold disabled:opacity-60"
                          style={{ backgroundColor: uiColor1, color: uiColor1Text }}
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 max-h-[520px] overflow-auto rounded-md border border-slate-300 p-2">
                    {filteredCategories.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-slate-500">{labels.noCategoriesToShow}</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setSelectedPanelCategory(cat);
                              setCategoriesPanelMode("parts");
                              setPanelPartsPage(1);
                              void loadPanelCategoryParts(cat, "");
                            }}
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-slate-800 hover:bg-slate-50"
                          >
                            <span className="text-base">{cat.name}</span>
                            <span className="ml-2 text-sm text-slate-500">({cat.part_count} parts)</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {showLoaderPopup ? (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/20 p-4">
              <div className="w-[140px] rounded-xl border p-2 shadow-xl" style={{ backgroundColor: uiColor1, borderColor: uiColor3 }}>
                <div className="rounded-lg bg-white p-1">
                  <Lottie animationData={loaderAnimationData} loop autoplay className="h-20 w-full" />
                </div>
              </div>
            </div>
          ) : null}
        </main>
      );
    }

    if (activeSection === "balance_usuario") {
      return (
        <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
          <div className="relative mx-auto w-full max-w-[800px] rounded-2xl border-[10px] p-[1px] shadow-xl" style={{ borderColor: uiColor1 }}>
            {unreadChatsFloatingAlert}
            {unreadChatsPopupOverlay}
            {memberChatPopupOverlay}
            {deleteUserConfirmPopupOverlay}
            <div className="rounded-xl border-[5px] bg-white p-4 sm:p-8" style={{ borderColor: currentLugColor2 || "#ffffff", backgroundColor: "#ffffff" }}>
              <header>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-boogaloo text-3xl font-semibold text-slate-900">Balance de usuario</h2>
                    <button
                      type="button"
                      onClick={() => {
                        navigateSectionClient("dashboard", "/dashboard");
                      }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    {labels.back}
                  </button>
                </div>
                <div className="mt-3 h-[5px] w-full rounded-full" style={{ backgroundColor: currentLugColor2 || "#ffffff" }} />
                {status ? <p className="mt-2 text-sm text-slate-700">{status}</p> : null}
              </header>

              <section className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
                <h3 className="font-boogaloo text-2xl text-slate-900">Minifiguras</h3>
                <div className="mt-2 text-sm leading-5 text-slate-700">
                  <p>{`Completas: ${minifigGlobalOwnedStats.complete}`}</p>
                  <p>{`Con Faltantes: ${minifigGlobalOwnedStats.missing}`}</p>
                  <p>{`Piezas faltantes: ${minifigGlobalMissingPiecesCount}`}</p>
                  <p>{`Tengo en Total: ${minifigGlobalOwnedStats.total}`}</p>
                </div>
              </section>

            </div>
          </div>
        </main>
      );
    }

    if (activeSection === "mi_lug") {
      return (
        <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
          <div className="relative mx-auto w-full max-w-[800px] rounded-2xl border-[10px] p-[1px] shadow-xl" style={{ borderColor: uiColor1 }}>
            {unreadChatsFloatingAlert}
            {unreadChatsPopupOverlay}
            {memberChatPopupOverlay}
            {deleteUserConfirmPopupOverlay}
            <div className="rounded-xl border-[5px] bg-white p-4 sm:p-8" style={{ borderColor: currentLugColor2 || "#ffffff", backgroundColor: "#ffffff" }}>
              <header>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {(miLugHeaderLogo || currentLugLogoDataUrl || currentUserLug?.logo_data_url) ? (
                      <Image
                        src={miLugHeaderLogo || currentLugLogoDataUrl || currentUserLug?.logo_data_url || ""}
                        alt={currentUserLug?.nombre || "Logo LUG"}
                        width={56}
                        height={56}
                        unoptimized
                        className="h-14 w-14 object-contain"
                      />
                    ) : null}
                    <h2 className="font-boogaloo text-3xl font-semibold text-slate-900">{currentLugDisplayName}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigateSectionClient("dashboard", "/dashboard");
                    }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    {labels.back}
                  </button>
                </div>
                <div className="mt-3 h-[5px] w-full rounded-full" style={{ backgroundColor: currentLugColor2 || "#ffffff" }} />
              </header>

              <section className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-boogaloo text-xl text-slate-900">Integrantes</h3>
                  {miLugMembersMaxPage > 1 ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMiLugMembersPage((prev) => Math.max(1, prev - 1))}
                        disabled={miLugMembersCurrentPage <= 1}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        ←
                      </button>
                      <p className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700">{`${miLugMembersCurrentPage} / ${miLugMembersMaxPage}`}</p>
                      <button
                        type="button"
                        onClick={() => setMiLugMembersPage((prev) => Math.min(miLugMembersMaxPage, prev + 1))}
                        disabled={miLugMembersCurrentPage >= miLugMembersMaxPage}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        →
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-8">
                  {miLugMembersLoading ? (
                    <p className="col-span-full text-sm text-slate-600">{labels.loadingMembers}</p>
                  ) : miLugMembersRows.length === 0 ? (
                    <p className="col-span-full text-sm text-slate-500">{labels.noMembers}</p>
                  ) : (
                    miLugMembersVisibleRows.map((member) => {
                      const isCurrentViewer = member.id === userId;
                      return (
                        <button
                          key={`tile-member-${member.id}`}
                          type="button"
                          onClick={() => setSelectedMiLugMemberCard(member)}
                          className="h-24 rounded-md border border-slate-300 bg-white p-2 text-left"
                          style={isCurrentViewer ? { backgroundColor: currentLugColor2 || "#ffffff" } : undefined}
                        >
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                            <div className="h-12 w-12 border border-slate-200 bg-slate-50 p-1">
                              <Image
                                src={getFaceImagePath(getAvatarFaceForMember(member.id, member.avatar_key))}
                                alt={member.full_name}
                                width={40}
                                height={40}
                                unoptimized
                                className="h-full w-full object-contain"
                              />
                            </div>
                            <p className="w-full break-words text-xs font-semibold leading-tight text-slate-800">{member.full_name}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
                <h3 className="font-boogaloo text-xl text-slate-900">POOL</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void openOffersGivenPanel()}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {labels.offeredToOthers}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openOffersReceivedPanel()}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {labels.offeredToMe}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMiLugWishlistPoolPanel(true)}
                    className="h-12 w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-800"
                  >
                    {labels.poolWishlist}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMiLugSalesPoolPanel(true)}
                    className="h-12 w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-800"
                  >
                    {labels.poolSales}
                  </button>
                </div>
              </section>

              {showMiLugMembersPanel ? (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowMiLugMembersPanel(false)}>
                  <div className="w-full max-w-[560px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-boogaloo text-2xl text-slate-900">{labels.members}</p>
                      <button
                        type="button"
                        onClick={() => setShowMiLugMembersPanel(false)}
                        className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                      >
                        {labels.close}
                      </button>
                    </div>

                    <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">
                      {miLugMembersLoading ? (
                        <p className="text-sm text-slate-600">{labels.loadingMembers}</p>
                      ) : miLugMembersRows.length === 0 ? (
                        <p className="text-sm text-slate-500">{labels.noMembers}</p>
                      ) : (
                        miLugMembersRows.map((member) => {
                          const social = getSocialPlatformLabel(member.social_platform);
                          const socialUrl = buildSocialUrl(member.social_platform, member.social_handle);
                          const socialLabel = member.social_handle || labels.noSocial;

                          return (
                            <div key={member.id} className="rounded-md border border-slate-200 px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-start gap-3">
                                  <div className="h-12 w-12 shrink-0 border border-slate-200 bg-slate-50 p-1">
                                    <Image
                                      src={getFaceImagePath(getAvatarFaceForMember(member.id, member.avatar_key))}
                                      alt={member.full_name}
                                      width={40}
                                      height={40}
                                      unoptimized
                                      className="h-full w-full object-contain"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <p className="truncate text-sm font-semibold text-slate-900">{member.full_name}</p>
                                      {member.rol_lug === "admin" ? (
                                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                          Admin
                                        </span>
                                      ) : null}
                                      {rolLug === "admin" && member.rol_lug !== "admin" && member.id !== userId ? (
                                        <button
                                          type="button"
                                          onClick={() => void promoteMiLugMemberToAdmin(member.id, member.full_name)}
                                          disabled={promoteMemberLoadingId === member.id}
                                          className="rounded-md border px-2 py-0.5 text-[10px] font-semibold"
                                          style={{
                                            backgroundColor: currentLugColor2 || "#ffffff",
                                            color: getContrastTextColor(currentLugColor2 || "#ffffff"),
                                            borderColor: currentLugColor3 || "#111111",
                                          }}
                                        >
                                          {promoteMemberLoadingId === member.id ? t.processing : labels.makeAdmin}
                                        </button>
                                      ) : null}
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                      <span
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                        style={{ backgroundColor: social.bg }}
                                        title={member.social_platform || "Red social"}
                                      >
                                        {social.logo}
                                      </span>
                                      {socialUrl ? (
                                        <a href={socialUrl} target="_blank" rel="noreferrer" className="truncate text-xs font-semibold text-sky-700 hover:underline">
                                          {socialUrl}
                                        </a>
                                      ) : (
                                        <p className="truncate text-xs text-slate-600">{socialLabel}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void openMiLugMemberChat(member.id, member.full_name)}
                                    disabled={memberChatLoadingId === member.id}
                                    className="rounded-md border border-slate-300 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-60"
                                    title="Abrir chat"
                                  >
                                    <Image
                                      src="/api/avatar/Mensaje_A.svg"
                                      alt="Mensaje"
                                      width={22}
                                      height={22}
                                      unoptimized
                                      className="h-[22px] w-[22px] object-contain"
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedMiLugMemberCard ? (
                <div className="fixed inset-0 z-[71] flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setSelectedMiLugMemberCard(null)}>
                  <div className="w-full max-w-[290px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="h-20 w-20 border border-slate-200 bg-slate-50 p-1">
                        <Image
                          src={getFaceImagePath(getAvatarFaceForMember(selectedMiLugMemberCard.id, selectedMiLugMemberCard.avatar_key))}
                          alt={selectedMiLugMemberCard.full_name}
                          width={72}
                          height={72}
                          unoptimized
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <p className="text-2xl font-normal text-slate-900" style={{ fontFamily: "Chewy, cursive" }}>
                        {selectedMiLugMemberCard.full_name}
                      </p>
                      {selectedMiLugMemberCard.rol_lug === "admin" ? (
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">ADMIN</span>
                      ) : null}
                      <p className="flex items-center gap-1 text-sm text-slate-700">
                        <span>{getSocialPlatformLabel(selectedMiLugMemberCard.social_platform).logo}</span>
                        <span>{selectedMiLugMemberCard.social_handle || labels.noSocial}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const member = selectedMiLugMemberCard;
                          setSelectedMiLugMemberCard(null);
                          if (member) {
                            void openMiLugMemberChat(member.id, member.full_name);
                          }
                        }}
                        disabled={memberChatLoadingId === selectedMiLugMemberCard.id || selectedMiLugMemberCard.id === userId}
                        className="rounded-md border border-slate-300 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Abrir chat"
                      >
                        <Image
                          src="/api/avatar/Mensaje_A.svg"
                          alt="Mensaje"
                          width={24}
                          height={24}
                          unoptimized
                          className="h-6 w-6 object-contain"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {memberChatPopupOverlay}

              {showOffersGivenPanel ? (
                <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowOffersGivenPanel(false)}>
                  <div className="w-full max-w-[560px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="font-boogaloo text-xl text-slate-900">{labels.offeredToOthers}</p>
                        <button
                          type="button"
                          onClick={() => printOffersSummary(labels.offeredToOthers, offersGivenRows)}
                          className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                        >
                          Print
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOffersGivenPanel(false)}
                        className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="mt-3 max-h-[360px] overflow-auto space-y-2">
                      {offersPanelsLoading ? (
                        <p className="text-sm text-slate-500">{labels.loading}</p>
                      ) : offersGivenRows.length === 0 ? (
                        <p className="text-sm text-slate-500">{labels.noOffersRegistered}</p>
                      ) : (
                        offersGivenRows.map((row) => (
                          <div key={row.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">{row.userName}</p>
                              <p className="truncate text-xs text-slate-600">{row.partLabel}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{row.quantity}</p>
                              <button
                                type="button"
                                onClick={() => void releaseOfferFromGivenPanel(row.id)}
                                className="rounded-md border border-red-300 px-2 py-0.5 text-[10px] font-semibold text-red-700"
                              >
                                Liberar oferta
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {showOffersReceivedPanel ? (
                <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowOffersReceivedPanel(false)}>
                  <div className="w-full max-w-[560px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="font-boogaloo text-xl text-slate-900">{labels.offeredToMe}</p>
                        <button
                          type="button"
                          onClick={() => printOffersSummary(labels.offeredToMe, offersReceivedRows)}
                          className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                        >
                          Print
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOffersReceivedPanel(false)}
                        className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="mt-3 max-h-[360px] overflow-auto space-y-2">
                      {offersPanelsLoading ? (
                        <p className="text-sm text-slate-500">{labels.loading}</p>
                      ) : offersReceivedRows.length === 0 ? (
                        <p className="text-sm text-slate-500">{labels.noOffersReceived}</p>
                      ) : (
                        offersReceivedRows.map((row) => (
                          <div key={row.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">{row.userName}</p>
                              <p className="truncate text-xs text-slate-600">{row.partLabel}</p>
                            </div>
                            <p className="text-sm font-semibold text-slate-900">{row.quantity}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {showMiLugWishlistPoolPanel ? (
                <div className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowMiLugWishlistPoolPanel(false)}>
                  <div className="w-full max-w-[980px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-boogaloo text-xl text-slate-900">{labels.poolWishlist}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setHideOwnPoolItems((prev) => !prev)}
                          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                        >
                          <span>No mostrar mis items en el pool</span>
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-slate-300 bg-white text-[11px] leading-none">
                            {hideOwnPoolItems ? "✓" : ""}
                          </span>
                        </button>
                        <select
                          value={miLugWishlistSort}
                          onChange={(event) => {
                            setMiLugWishlistSort(event.target.value as "codigo" | "color" | "usuario");
                            setMiLugWishlistPage(1);
                          }}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
                        >
                          <option value="codigo">{labels.sortCode}</option>
                          <option value="color">{labels.sortColor}</option>
                          <option value="usuario">{labels.sortUser}</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setMiLugWishlistPage((prev) => Math.max(1, prev - 1))}
                          disabled={miLugWishlistCurrentPage <= 1}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                        >
                          ←
                        </button>
                        <p className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700">{`${miLugWishlistCurrentPage} / ${miLugWishlistMaxPage}`}</p>
                        <button
                          type="button"
                          onClick={() => setMiLugWishlistPage((prev) => Math.min(miLugWishlistMaxPage, prev + 1))}
                          disabled={miLugWishlistCurrentPage >= miLugWishlistMaxPage}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowMiLugWishlistPoolPanel(false)}
                          className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                        >
                          {labels.close}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 max-h-[520px] overflow-auto">
                      <div className="grid grid-cols-10 gap-2">
                        {miLugWishlistVisibleItems.length === 0 ? (
                          <p className="col-span-10 text-sm text-slate-500">{labels.noPublicWishlist}</p>
                        ) : (
                          miLugWishlistVisibleItems.map((item) => (
                            <button
                              key={`wish-${item.id}`}
                              type="button"
                              onClick={() => setSelectedMiLugPoolItem({ type: "wishlist", item })}
                              className="rounded-md border border-slate-300 bg-white p-2 text-center"
                            >
                              <div
                                className={`relative mx-auto flex h-[62px] w-[62px] items-center justify-center overflow-hidden rounded bg-slate-50 ${
                                  item.imgmatchcolor ? "border border-slate-200" : "border-2 border-red-500"
                                }`}
                              >
                                {item.part_img_url ? (
                                  <Image
                                    src={item.part_img_url}
                                    alt={item.part_name}
                                    width={56}
                                    height={56}
                                    unoptimized
                                    className="h-[56px] w-[56px] object-contain"
                                  />
                                ) : null}
                                {!item.imgmatchcolor ? (
                                  <span className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center" title="El color de esta pieza no es el mostrado en la imagen">
                                    <Image
                                      src="/api/avatar/Exclamacion.svg"
                                      alt="Advertencia"
                                      width={16}
                                      height={16}
                                      unoptimized
                                      className="h-4 w-4 object-contain"
                                    />
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 truncate text-[11px] font-semibold text-slate-800">{item.part_num}</p>
                              <p className="truncate text-[10px] text-slate-600">{item.publisher_name}</p>
                              <p className="font-boogaloo text-xl leading-none text-slate-900">{item.remaining_quantity}</p>
                              {item.current_user_offer_quantity > 0 ? <p className="text-[10px] font-semibold text-emerald-700">{`Yo ofrecí ${item.current_user_offer_quantity}`}</p> : null}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {showMiLugSalesPoolPanel ? (
                <div className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowMiLugSalesPoolPanel(false)}>
                  <div className="w-full max-w-[980px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-boogaloo text-xl text-slate-900">{labels.poolSales}</p>
                      <div className="flex items-center gap-2">
                        <select
                          value={miLugSaleSort}
                          onChange={(event) => {
                            setMiLugSaleSort(event.target.value as "codigo" | "color" | "usuario" | "price_asc" | "price_desc");
                            setMiLugSalePage(1);
                          }}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
                        >
                          <option value="codigo">{labels.sortCode}</option>
                          <option value="color">{labels.sortColor}</option>
                          <option value="usuario">{labels.sortUser}</option>
                          <option value="price_asc">{labels.sortPriceAsc}</option>
                          <option value="price_desc">{labels.sortPriceDesc}</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setMiLugSalePage((prev) => Math.max(1, prev - 1))}
                          disabled={miLugSaleCurrentPage <= 1}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                        >
                          ←
                        </button>
                        <p className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700">{`${miLugSaleCurrentPage} / ${miLugSaleMaxPage}`}</p>
                        <button
                          type="button"
                          onClick={() => setMiLugSalePage((prev) => Math.min(miLugSaleMaxPage, prev + 1))}
                          disabled={miLugSaleCurrentPage >= miLugSaleMaxPage}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowMiLugSalesPoolPanel(false)}
                          className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                        >
                          {labels.close}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 max-h-[520px] overflow-auto">
                      <div className="grid grid-cols-10 gap-2">
                        {miLugSaleVisibleItems.length === 0 ? (
                          <p className="col-span-10 text-sm text-slate-500">{labels.noPublicSales}</p>
                        ) : (
                          miLugSaleVisibleItems.map((item) => (
                            <button
                              key={`sale-${item.id}`}
                              type="button"
                              onClick={() => setSelectedMiLugPoolItem({ type: "venta", item })}
                              className="rounded-md border border-slate-300 bg-white p-2 text-center"
                            >
                              <p className="mb-1 font-boogaloo text-xl leading-none text-emerald-700">{item.value == null ? "$-" : `$${item.value}`}</p>
                              <div
                                className={`relative mx-auto flex h-[62px] w-[62px] items-center justify-center overflow-hidden rounded bg-slate-50 ${
                                  item.imgmatchcolor ? "border border-slate-200" : "border-2 border-red-500"
                                }`}
                              >
                                {item.part_img_url ? (
                                  <Image
                                    src={item.part_img_url}
                                    alt={item.part_name}
                                    width={56}
                                    height={56}
                                    unoptimized
                                    className="h-[56px] w-[56px] object-contain"
                                  />
                                ) : null}
                                {!item.imgmatchcolor ? (
                                  <span className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center" title="El color de esta pieza no es el mostrado en la imagen">
                                    <Image
                                      src="/api/avatar/Exclamacion.svg"
                                      alt="Advertencia"
                                      width={16}
                                      height={16}
                                      unoptimized
                                      className="h-4 w-4 object-contain"
                                    />
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 truncate text-[11px] font-semibold text-slate-800">{item.part_num}</p>
                              <p className="truncate text-[10px] text-slate-600">{item.publisher_name}</p>
                              <p className="font-boogaloo text-xl leading-none text-slate-900">{item.quantity}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedMiLugPoolItem ? (
                <div
                  className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/55 p-4"
                  onClick={() => setSelectedMiLugPoolItem(null)}
                >
                  <div
                    className="w-full max-w-md rounded-xl border border-slate-300 bg-white p-5 shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-boogaloo text-2xl text-slate-900">
                        {selectedMiLugPoolItem.type === "venta" ? labels.detailSale : labels.detailWishlist}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedMiLugPoolItem(null)}
                        className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                      >
                        Cerrar
                      </button>
                    </div>

                    <div className="mt-4 flex items-start gap-3">
                      <div
                        className={`relative flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-md bg-slate-50 ${
                          selectedMiLugPoolItem.item.imgmatchcolor ? "border border-slate-300" : "border-2 border-red-500"
                        }`}
                      >
                        {selectedMiLugPoolItem.item.part_img_url ? (
                          <Image
                            src={selectedMiLugPoolItem.item.part_img_url}
                            alt={selectedMiLugPoolItem.item.part_name}
                            width={96}
                            height={96}
                            unoptimized
                            className="h-[96px] w-[96px] object-contain"
                          />
                        ) : null}
                        {!selectedMiLugPoolItem.item.imgmatchcolor ? (
                          <span
                            className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center"
                            title="El color de esta pieza no es el mostrado en la imagen"
                          >
                            <Image
                              src="/api/avatar/Exclamacion.svg"
                              alt="Advertencia"
                              width={18}
                              height={18}
                              unoptimized
                              className="h-[18px] w-[18px] object-contain"
                            />
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-base font-semibold text-slate-900">{`${selectedMiLugPoolItem.item.part_num} - ${selectedMiLugPoolItem.item.part_name}`}</p>
                        <div>
                          <span
                            className="inline-flex h-8 min-w-[160px] max-w-[240px] items-center justify-center truncate rounded-md border px-3 text-[12px] font-semibold"
                            style={(() => {
                              const colorLabel = selectedMiLugPoolItem.item.color_label;
                              const colorHex = colorLabel ? colorHexByLabel.get(normalizeColorLabel(colorLabel)) : null;
                              const bg = colorHex ? `#${colorHex}` : "#f8fafc";
                              return {
                                backgroundColor: bg,
                                color: colorHex ? getContrastTextColor(bg) : "#334155",
                                borderColor: colorHex ? "#94a3b8" : "#cbd5e1",
                              };
                            })()}
                          >
                            {selectedMiLugPoolItem.item.color_label || NO_COLOR_LABEL}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">{`${labels.quantityWord}: ${selectedMiLugPoolItem.item.quantity}`}</p>
                        <p className="text-sm text-slate-700">{`${labels.publishedByWord}: ${selectedMiLugPoolItem.item.publisher_name}`}</p>

                        {selectedMiLugPoolItem.type === "wishlist" && selectedMiLugPoolItem.item.publisher_id !== userId ? (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={miLugOfferQuantityInput}
                              onChange={(event) => setMiLugOfferQuantityInput(event.target.value)}
                              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => void submitWishlistOfferFromPool()}
                              className="rounded-md px-3 py-1 text-sm font-semibold"
                              style={{ backgroundColor: uiColor1, color: uiColor1Text }}
                            >
                              {labels.iHave}
                            </button>
                            {selectedMiLugPoolItem.item.current_user_offer_quantity > 0 ? (
                              <button
                                type="button"
                                onClick={() => void clearWishlistOfferFromPool()}
                                className="rounded-md border border-red-300 px-3 py-1 text-sm font-semibold text-red-700"
                              >
                                Liberar oferta
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-2 w-full px-2 text-center">
            <p className="mx-auto inline-block px-2 text-xs font-semibold tracking-wide" style={{ color: "#a8a8a8" }}>
              {footerLegend || "LUGs App"}
            </p>
          </div>
        </main>
      );
    }

    if (activeSection === "minifiguras") {
      return (
        <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
          <div className="relative mx-auto w-full max-w-[980px] rounded-2xl border-[10px] p-[1px] shadow-xl" style={{ borderColor: uiColor1 }}>
            {unreadChatsFloatingAlert}
            {unreadChatsPopupOverlay}
            {memberChatPopupOverlay}
            {deleteUserConfirmPopupOverlay}
            <div className="rounded-xl border-[5px] bg-white p-4 sm:p-8" style={{ borderColor: currentLugColor2 || "#ffffff", backgroundColor: "#ffffff" }}>
              <header>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-boogaloo text-3xl font-normal text-slate-900">{labels.minifigSectionTitle}</h2>
                    <div className="text-sm font-normal leading-5 text-slate-700">
                      <p>{`Completas: ${minifigGlobalOwnedStats.complete}`}</p>
                      <p>{`Con Faltantes: ${minifigGlobalOwnedStats.missing}`}</p>
                      <p>{`Piezas faltantes: ${minifigGlobalMissingPiecesCount}`}</p>
                      <p>{`Tengo en Total: ${minifigGlobalOwnedStats.total}`}</p>
                      <p>{`Favoritas: ${minifigGlobalOwnedStats.favorites}`}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigateSectionClient("dashboard", "/dashboard");
                    }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    {labels.back}
                  </button>
                </div>
                <div className="mt-3 h-[5px] w-full rounded-full" style={{ backgroundColor: currentLugColor2 || "#ffffff" }} />
              </header>

              <section className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMinifigSeriesPopup(true)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                  >
                    Collectable Series
                  </button>
                  <input
                    type="text"
                    value={minifigSearchQuery}
                    onChange={(event) => setMinifigSearchQuery(event.target.value)}
                    placeholder="Buscar minifigura"
                    className="h-10 min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 text-sm text-slate-800"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMinifigFiguresFilter("all");
                      setShowOnlyFavoriteFigures(false);
                      void saveMinifigUiPreferences({ show_only_favorite_figures: false });
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                      minifigFiguresFilter === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800"
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMinifigFiguresFilter("missing");
                      setShowOnlyFavoriteFigures(false);
                      void saveMinifigUiPreferences({ show_only_favorite_figures: false });
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                      minifigFiguresFilter === "missing" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800"
                    }`}
                  >
                    Solo con faltantes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMinifigFiguresFilter("complete");
                      setShowOnlyFavoriteFigures(false);
                      void saveMinifigUiPreferences({ show_only_favorite_figures: false });
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                      minifigFiguresFilter === "complete" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800"
                    }`}
                  >
                    Solo completas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMinifigFiguresFilter("favorite");
                      setShowOnlyFavoriteFigures(true);
                      void saveMinifigUiPreferences({ show_only_favorite_figures: true });
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                      minifigFiguresFilter === "favorite" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800"
                    }`}
                  >
                    Favoritas
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
                  {minifigSearchQuery.trim().length > 0 ? (
                    minifigSearchLoading ? (
                      <p className="text-sm text-slate-500">{labels.loadingSeriesItems}</p>
                    ) : minifigSearchResults.length === 0 ? (
                      <p className="text-sm text-slate-500">{labels.noSeriesItems}</p>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                        {minifigSearchResults.map((fig) => {
                          const hasMissingParts = Boolean(minifigSetHasMissingPartsBySetNum[fig.set_num]);
                          const isOwned = Boolean(minifigFigureCheckedBySetNum[fig.set_num]);
                          const missingRows = minifigMissingPartsPreviewBySetNum[fig.set_num] ?? [];
                          const missingRowsToShow = missingRows.slice(0, 3);
                          const missingRowsHiddenCount = Math.max(0, missingRows.length - missingRowsToShow.length);
                          const missingRowsLoading = Boolean(minifigMissingPartsPreviewLoadingBySetNum[fig.set_num]);
                          const figureImageScaleClass = hasMissingParts ? "h-[80%] w-[80%]" : "h-[88%] w-[88%]";

                          const backgroundColor = hasMissingParts
                            ? currentLugColor2 || "#ffffff"
                            : isOwned
                              ? currentLugColor1 || "#006eb2"
                              : "#ffffff";
                          const textColor = getContrastTextColor(backgroundColor);

                          return (
                            <div
                              key={`search-${fig.set_num}`}
                              className="rounded-md border p-2"
                              style={{
                                borderColor: currentLugColor3 || "#cbd5e1",
                                backgroundColor,
                                color: textColor,
                              }}
                            >
                              <div
                                className="relative mx-auto w-full max-w-[180px]"
                                onDoubleClick={() => setSelectedMinifigForImagePopup(fig)}
                              >
                                <div
                                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded border border-slate-200 bg-white"
                                >
                                  {fig.set_img_url ? (
                                    <Image
                                      src={fig.set_img_url}
                                      alt={fig.name}
                                      width={220}
                                      height={220}
                                      unoptimized
                                      className={`object-contain ${figureImageScaleClass}`}
                                    />
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const nextFavorite = !minifigFigureFavoriteBySetNum[fig.set_num];
                                    setMinifigFigureFavoriteBySetNum((prev) => ({
                                      ...prev,
                                      [fig.set_num]: nextFavorite,
                                    }));
                                    void saveMinifigSetFavoriteState(fig.set_num, nextFavorite);
                                  }}
                                  className="absolute right-1 top-1 text-2xl leading-none"
                                  style={{ color: minifigFigureFavoriteBySetNum[fig.set_num] ? "#111111" : "#94a3b8" }}
                                >
                                  {minifigFigureFavoriteBySetNum[fig.set_num] ? "★" : "☆"}
                                </button>
                              </div>
                              <p className="mt-1 truncate text-[12px] font-semibold">{fig.name}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(minifigFigureCheckedBySetNum[fig.set_num])}
                                  onChange={(event) => {
                                    const nextChecked = event.target.checked;
                                    setMinifigFigureCheckedBySetNum((prev) => ({
                                      ...prev,
                                      [fig.set_num]: nextChecked,
                                    }));
                                    void saveMinifigSetOwnedState(fig.set_num, nextChecked);
                                  }}
                                  className="h-6 w-6 rounded border-slate-300 text-emerald-700"
                                />
                                <button
                                  type="button"
                                  onClick={() => void openMinifigFigureParts(fig)}
                                  className="rounded-md border px-2 py-0.5 text-[10px] font-semibold"
                                  style={{ borderColor: currentLugColor3 || "#94a3b8", color: "inherit" }}
                                >
                                  PARTS
                                </button>
                              </div>
                              {hasMissingParts ? (
                                <div className="mt-2 flex items-center gap-1">
                                  {missingRowsLoading && missingRows.length === 0
                                    ? Array.from({ length: 3 }).map((_, index) => (
                                        <div
                                          key={`${fig.set_num}-missing-loading-${index}`}
                                          className="h-[40px] w-[40px] animate-pulse rounded border border-white/60 bg-white/40"
                                        />
                                      ))
                                    : missingRowsToShow.map((part, index) => (
                                        <div
                                          key={`${fig.set_num}-missing-${part.row_id}-${index}`}
                                          className="flex h-[40px] w-[40px] items-center justify-center overflow-hidden rounded border border-white/60 bg-white/85"
                                        >
                                          {part.part_img_url ? (
                                            <Image
                                              src={part.part_img_url}
                                              alt={part.part_name || part.part_num}
                                              width={36}
                                              height={36}
                                              unoptimized
                                              className="h-[36px] w-[36px] object-contain"
                                            />
                                          ) : (
                                            <span className="text-[9px] font-semibold text-slate-700">{part.part_num}</span>
                                          )}
                                        </div>
                                      ))}
                                  {missingRowsHiddenCount > 0 ? (
                                    <span className="ml-1 text-[10px] font-semibold" style={{ color: textColor }}>
                                      +{missingRowsHiddenCount}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : checkedMinifigSeriesIds.length === 0 ? (
                    <p className="text-sm text-slate-500">{labels.selectSeriesHint}</p>
                  ) : (
                    <div className="space-y-4">
                      {checkedMinifigSeriesIds.map((seriesId) => {
                        const figures = minifigFiguresBySeriesId[seriesId] ?? [];
                        const loading = Boolean(minifigFiguresLoadingBySeriesId[seriesId]);
                        const visibleFigures = figures.filter((fig) => {
                          const hasMissingParts = Boolean(minifigSetHasMissingPartsBySetNum[fig.set_num]);
                          const isFavorite = Boolean(minifigFigureFavoriteBySetNum[fig.set_num]);
                          const isOwned = Boolean(minifigFigureCheckedBySetNum[fig.set_num]);

                          if (minifigFiguresFilter === "missing") {
                            return hasMissingParts;
                          }
                          if (minifigFiguresFilter === "complete") {
                            return isOwned && !hasMissingParts;
                          }
                          if (minifigFiguresFilter === "favorite") {
                            return isFavorite;
                          }
                          return true;
                        });

                        return (
                          <div key={`series-items-${seriesId}`}>
                            {loading ? <p className="mt-1 text-sm text-slate-500">{labels.loadingSeriesItems}</p> : null}
                            {!loading && visibleFigures.length === 0 ? <p className="mt-1 text-sm text-slate-500">{labels.noSeriesItems}</p> : null}
                            {!loading && visibleFigures.length > 0 ? (
                              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                                {visibleFigures.map((fig) => {
                                  const hasMissingParts = Boolean(minifigSetHasMissingPartsBySetNum[fig.set_num]);
                                  const isOwned = Boolean(minifigFigureCheckedBySetNum[fig.set_num]);
                                  const missingRows = minifigMissingPartsPreviewBySetNum[fig.set_num] ?? [];
                                  const missingRowsToShow = missingRows.slice(0, 3);
                                  const missingRowsHiddenCount = Math.max(0, missingRows.length - missingRowsToShow.length);
                                  const missingRowsLoading = Boolean(minifigMissingPartsPreviewLoadingBySetNum[fig.set_num]);
                                  const figureImageScaleClass = hasMissingParts ? "h-[80%] w-[80%]" : "h-[88%] w-[88%]";

                                  const backgroundColor = hasMissingParts
                                    ? currentLugColor2 || "#ffffff"
                                    : isOwned
                                      ? currentLugColor1 || "#006eb2"
                                      : "#ffffff";
                                  const textColor = getContrastTextColor(backgroundColor);

                                  return (
                                    <div
                                      key={`${seriesId}-${fig.set_num}`}
                                      className="rounded-md border p-2"
                                      style={{
                                        borderColor: currentLugColor3 || "#cbd5e1",
                                        backgroundColor,
                                        color: textColor,
                                      }}
                                    >
                                      <div
                                        className="relative mx-auto w-full max-w-[180px]"
                                        onDoubleClick={() => setSelectedMinifigForImagePopup(fig)}
                                      >
                                        <div
                                          className="flex aspect-square w-full items-center justify-center overflow-hidden rounded border border-slate-200 bg-white"
                                        >
                                          {fig.set_img_url ? (
                                            <Image
                                              src={fig.set_img_url}
                                              alt={fig.name}
                                              width={220}
                                              height={220}
                                              unoptimized
                                              className={`object-contain ${figureImageScaleClass}`}
                                            />
                                          ) : null}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            const nextFavorite = !minifigFigureFavoriteBySetNum[fig.set_num];
                                            setMinifigFigureFavoriteBySetNum((prev) => ({
                                              ...prev,
                                              [fig.set_num]: nextFavorite,
                                            }));
                                            void saveMinifigSetFavoriteState(fig.set_num, nextFavorite);
                                          }}
                                          className="absolute right-1 top-1 text-2xl leading-none"
                                          style={{ color: minifigFigureFavoriteBySetNum[fig.set_num] ? "#111111" : "#94a3b8" }}
                                        >
                                          {minifigFigureFavoriteBySetNum[fig.set_num] ? "★" : "☆"}
                                        </button>
                                      </div>
                                      <p className="mt-1 truncate text-[12px] font-semibold">{fig.name}</p>
                                      <div className="mt-1 flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(minifigFigureCheckedBySetNum[fig.set_num])}
                                          onChange={(event) => {
                                            const nextChecked = event.target.checked;
                                            setMinifigFigureCheckedBySetNum((prev) => ({
                                              ...prev,
                                              [fig.set_num]: nextChecked,
                                            }));
                                            void saveMinifigSetOwnedState(fig.set_num, nextChecked);
                                          }}
                                          className="h-6 w-6 rounded border-slate-300 text-emerald-700"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => void openMinifigFigureParts(fig)}
                                          className="rounded-md border px-2 py-0.5 text-[10px] font-semibold"
                                          style={{ borderColor: currentLugColor3 || "#94a3b8", color: "inherit" }}
                                        >
                                          PARTS
                                        </button>
                                      </div>
                                      {hasMissingParts ? (
                                        <div className="mt-2 flex items-center gap-1">
                                          {missingRowsLoading && missingRows.length === 0
                                            ? Array.from({ length: 3 }).map((_, index) => (
                                                <div
                                                  key={`${fig.set_num}-missing-loading-${index}`}
                                                  className="h-[40px] w-[40px] animate-pulse rounded border border-white/60 bg-white/40"
                                                />
                                              ))
                                            : missingRowsToShow.map((part, index) => (
                                                <div
                                                  key={`${fig.set_num}-missing-${part.row_id}-${index}`}
                                                  className="flex h-[40px] w-[40px] items-center justify-center overflow-hidden rounded border border-white/60 bg-white/85"
                                                >
                                                  {part.part_img_url ? (
                                                    <Image
                                                      src={part.part_img_url}
                                                      alt={part.part_name || part.part_num}
                                                      width={36}
                                                      height={36}
                                                      unoptimized
                                                      className="h-[36px] w-[36px] object-contain"
                                                    />
                                                  ) : (
                                                    <span className="text-[9px] font-semibold text-slate-700">{part.part_num}</span>
                                                  )}
                                                </div>
                                              ))}
                                          {missingRowsHiddenCount > 0 ? (
                                            <span className="ml-1 text-[10px] font-semibold" style={{ color: textColor }}>
                                              +{missingRowsHiddenCount}
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {showMinifigSeriesPopup ? (
                <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowMinifigSeriesPopup(false)}>
                  <div className="w-full max-w-[520px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="font-boogaloo text-2xl text-slate-900">Collectable Series</p>
                        <button
                          type="button"
                          onClick={() => {
                            const nextValue = !showOnlyFavoriteSeries;
                            setShowOnlyFavoriteSeries(nextValue);
                            void saveMinifigUiPreferences({ show_only_favorite_series: nextValue });
                          }}
                          className={`rounded-md border px-3 py-1 text-sm font-semibold ${
                            showOnlyFavoriteSeries ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                          }`}
                        >
                          Favoriotas
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMinifigSeriesPopup(false)}
                        className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                      >
                        {labels.close}
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ids = popupVisibleSeriesRows.map((series) => series.id);
                          if (ids.length === 0) {
                            return;
                          }
                          setMinifigSeriesCheckedById((prev) => {
                            const next = { ...prev };
                            ids.forEach((id) => {
                              next[id] = true;
                            });
                            return next;
                          });
                          ids.forEach((id) => {
                            void saveMinifigSeriesPreference(id, { is_selected: true });
                            void loadMinifigFiguresForSeries(id);
                          });
                        }}
                        className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        Seleccionar todo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const ids = popupVisibleSeriesRows.map((series) => series.id);
                          if (ids.length === 0) {
                            return;
                          }
                          setMinifigSeriesCheckedById((prev) => {
                            const next = { ...prev };
                            ids.forEach((id) => {
                              next[id] = false;
                            });
                            return next;
                          });
                          ids.forEach((id) => {
                            void saveMinifigSeriesPreference(id, { is_selected: false });
                          });
                        }}
                        className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        Deseleccionar todo
                      </button>
                    </div>

                    <div className="mt-3 max-h-[520px] space-y-2 overflow-auto pr-1">
                      {minifigSeriesLoading ? (
                        <p className="text-sm text-slate-600">{labels.loadingSeries}</p>
                      ) : popupVisibleSeriesRows.length === 0 ? (
                        <p className="text-sm text-slate-500">{labels.noSeriesFound}</p>
                      ) : (
                        popupVisibleSeriesRows.map((series) => (
                          <label key={`series-popup-${series.id}`} className="block cursor-pointer px-1 py-1">
                            <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(minifigSeriesCheckedById[series.id])}
                              onChange={(event) => {
                                const nextChecked = event.target.checked;
                                setMinifigSeriesCheckedById((prev) => ({
                                  ...prev,
                                  [series.id]: nextChecked,
                                }));
                                void saveMinifigSeriesPreference(series.id, { is_selected: nextChecked });
                                if (nextChecked) {
                                  void loadMinifigFiguresForSeries(series.id);
                                }
                              }}
                              className="mt-[2px] h-4 w-4 rounded border-slate-300 text-emerald-700"
                            />
                            <span className="text-sm font-semibold text-slate-800">{`${series.name} (${series.year_from ?? "-"})`}</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const nextFavorite = !minifigSeriesFavoriteById[series.id];
                                setMinifigSeriesFavoriteById((prev) => ({
                                  ...prev,
                                  [series.id]: nextFavorite,
                                }));
                                void saveMinifigSeriesPreference(series.id, { is_favorite: nextFavorite });
                              }}
                              className="text-2xl leading-none"
                              style={{ color: minifigSeriesFavoriteById[series.id] ? currentLugColor1 || "#006eb2" : "#94a3b8" }}
                              aria-label="Toggle favorite"
                            >
                              {minifigSeriesFavoriteById[series.id] ? "♥" : "♡"}
                            </button>
                            </div>
                            <div className="mt-1 pl-6">
                              {(() => {
                                const progress = minifigSeriesProgressById[series.id] ?? { owned: 0, total: 0 };
                                const percentage = progress.total > 0 ? Math.round((progress.owned / progress.total) * 100) : 0;
                                return (
                                  <>
                                    <div className="h-2 w-full max-w-[260px] overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                                      <div
                                        className={`h-full rounded-full ${percentage >= 100 ? "bg-emerald-500" : "bg-slate-400"}`}
                                        style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                                      />
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-slate-600">{`${progress.owned}/${progress.total}`}</p>
                                  </>
                                );
                              })()}
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {showMinifigPartsPopup ? (
                <div
                  className="fixed inset-0 z-[66] flex items-center justify-center bg-slate-900/45 p-4"
                  onClick={() => setShowMinifigPartsPopup(false)}
                >
                  <div className="w-full max-w-[760px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-boogaloo text-2xl text-slate-900">{selectedMinifigForParts?.name || "PARTS"}</p>
                      <button
                        type="button"
                        onClick={() => setShowMinifigPartsPopup(false)}
                        className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                      >
                        {labels.close}
                      </button>
                    </div>

                    <div className="mt-3 max-h-[520px] overflow-auto">
                      {minifigPartsLoading ? (
                        <p className="text-sm text-slate-600">{labels.loadingFigureParts}</p>
                      ) : minifigPartsRows.length === 0 ? (
                        <p className="text-sm text-slate-500">{labels.noFigureParts}</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                          {minifigPartsRows.map((part) => (
                            <div
                              key={part.row_id}
                              className={`rounded-md border p-2 ${
                                minifigPartCheckedByRowId[part.row_id] === false
                                  ? "border-red-300 bg-red-50"
                                  : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-start">
                                <input
                                  type="checkbox"
                                  checked={minifigPartCheckedByRowId[part.row_id] !== false}
                                  onChange={(event) => {
                                    const nextChecked = event.target.checked;
                                    const nextMap = {
                                      ...minifigPartCheckedByRowId,
                                      [part.row_id]: nextChecked,
                                    };
                                    setMinifigPartCheckedByRowId(nextMap);

                                    const setNum = selectedMinifigForParts?.set_num;
                                    if (!setNum) {
                                      return;
                                    }

                                    setMinifigSetHasMissingPartsBySetNum((prev) => ({
                                      ...prev,
                                      [setNum]: Object.values(nextMap).some((checked) => !checked),
                                    }));
                                    setMinifigMissingPartsPreviewBySetNum((prev) => ({
                                      ...prev,
                                      [setNum]: getMissingMinifigPartRows(minifigPartsRows, nextMap),
                                    }));

                                    void saveMinifigPartsInventoryState(setNum, nextMap);
                                  }}
                                  className="h-5 w-5 rounded border-slate-300 text-emerald-700"
                                />
                              </div>
                              <div className="mx-auto flex h-[84px] w-[84px] items-center justify-center overflow-hidden rounded border border-slate-200 bg-white">
                                {part.part_img_url ? (
                                  <Image
                                    src={part.part_img_url}
                                    alt={part.part_name}
                                    width={76}
                                    height={76}
                                    unoptimized
                                    className="h-[76px] w-[76px] object-contain"
                                  />
                                ) : null}
                              </div>
                              <p className="mt-1 truncate text-[11px] font-semibold text-slate-800">{part.part_num}</p>
                              <p className="truncate text-[11px] text-slate-700">{part.part_name}</p>
                              <p className="truncate text-[10px] text-slate-500">{part.color_name}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedMinifigForImagePopup ? (
                <div
                  className="fixed inset-0 z-[67] flex items-center justify-center bg-slate-900/55 p-4"
                  onClick={() => setSelectedMinifigForImagePopup(null)}
                >
                  <div className="w-full max-w-[760px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{selectedMinifigForImagePopup.name}</p>
                      <button
                        type="button"
                        onClick={() => setSelectedMinifigForImagePopup(null)}
                        className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                      >
                        {labels.close}
                      </button>
                    </div>
                    <div className="mx-auto flex aspect-square w-full max-w-[680px] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {selectedMinifigForImagePopup.set_img_url ? (
                        <Image
                          src={selectedMinifigForImagePopup.set_img_url}
                          alt={selectedMinifigForImagePopup.name}
                          width={680}
                          height={680}
                          unoptimized
                          className="h-[96%] w-[96%] object-contain"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      );
    }

    if (activeSection === "listas") {
      return (
        <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
          <div className="relative mx-auto w-full max-w-[800px] rounded-2xl border-[10px] p-[1px] shadow-xl" style={{ borderColor: uiColor1 }}>
            {unreadChatsFloatingAlert}
            {unreadChatsPopupOverlay}
            {memberChatPopupOverlay}
            {deleteUserConfirmPopupOverlay}
            <div className="rounded-xl border-[5px] bg-white p-4 sm:p-8" style={{ borderColor: currentLugColor2 || "#ffffff", backgroundColor: "#ffffff" }}>
              <header>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-boogaloo text-3xl font-semibold text-slate-900">{labels.lists}</h2>
                    <button
                      type="button"
                      onClick={() => void openOffersGivenPanel()}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {labels.offeredToOthers}
                    </button>
                    <button
                      type="button"
                      onClick={() => void openOffersReceivedPanel()}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {labels.offeredToMe}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigateSectionClient("dashboard", "/dashboard");
                    }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    {labels.back}
                  </button>
                </div>
                <div className="mt-3 h-[5px] w-full rounded-full" style={{ backgroundColor: currentLugColor2 || "#ffffff" }} />
              </header>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateListaPanel(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-2xl font-semibold leading-none text-slate-700"
                >
                  +
                </button>
                <p className="text-sm font-semibold text-slate-800">{labels.createList}</p>
              </div>

              <div className="mt-4 space-y-5">
                <section>
                  <h3 className="font-boogaloo text-2xl font-semibold text-slate-900">{labels.yourWishlists}</h3>
                  <div className="mt-2 space-y-2">
                    {listasDeseos.length === 0 ? (
                      <p className="text-sm text-slate-500">{labels.noWishlistLists}</p>
                    ) : (
                      listasDeseos.map((item) => (
                        <div
                          key={item.id}
                          onClick={(event) => {
                            if ((event.target as HTMLElement).closest("button")) {
                              return;
                            }
                            void openListDetailPage(item);
                          }}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-300 px-3 py-2"
                          style={item.nombre === AUTO_MINIFIG_MISSING_LIST_NAME ? { backgroundColor: "#f3f4f6" } : undefined}
                        >
                          <Image
                            src={item.nombre === AUTO_MINIFIG_MISSING_LIST_NAME ? "/api/avatar/Minifigura_silueta_B.png" : "/api/avatar/pieza_silueta.png"}
                            alt={item.nombre === AUTO_MINIFIG_MISSING_LIST_NAME ? "Minifigura" : "Pieza"}
                            width={52}
                            height={52}
                            unoptimized
                            className="h-12 w-12 object-contain"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{item.nombre}</p>
                              <button
                                type="button"
                                onClick={() => openRenameListaPanel(item)}
                                className="rounded-md border border-slate-300 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                                title={labels.renameListTitle}
                              >
                                ✎
                              </button>
                            </div>
                            <p className="text-xs text-slate-600">{buildListStatsLabel(item.lotes, item.piezas)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => void setListaVisibilidad(item.id, "privado")}
                                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                    item.visibilidad === "privado" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                                  }`}
                                >
                                  {labels.private}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void setListaVisibilidad(item.id, "publico")}
                                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                    item.visibilidad === "publico" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                                  }`}
                                >
                                  {labels.public}
                                </button>
                            </div>
                            {item.nombre !== AUTO_MINIFIG_MISSING_LIST_NAME ? (
                              <button
                                type="button"
                                onClick={() => openDeleteListaConfirm(item)}
                                className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700"
                              >
                                {labels.deleteList}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="font-boogaloo text-2xl font-semibold text-slate-900">{labels.yourSaleLists}</h3>
                  <div className="mt-2 space-y-2">
                    {listasVenta.length === 0 ? (
                      <p className="text-sm text-slate-500">{labels.noSaleLists}</p>
                    ) : (
                      listasVenta.map((item) => (
                        <div
                          key={item.id}
                          onClick={(event) => {
                            if ((event.target as HTMLElement).closest("button")) {
                              return;
                            }
                            void openListDetailPage(item);
                          }}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-300 px-3 py-2"
                        >
                          <Image
                            src="/api/avatar/pieza_silueta.png"
                            alt="Pieza"
                            width={52}
                            height={52}
                            unoptimized
                            className="h-12 w-12 object-contain"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{item.nombre}</p>
                              <button
                                type="button"
                                onClick={() => openRenameListaPanel(item)}
                                className="rounded-md border border-slate-300 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                                title={labels.renameListTitle}
                              >
                                ✎
                              </button>
                            </div>
                            <p className="text-xs text-slate-600">{buildListStatsLabel(item.lotes, item.piezas)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => void setListaVisibilidad(item.id, "privado")}
                                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                    item.visibilidad === "privado" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                                  }`}
                                >
                                  {labels.private}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void setListaVisibilidad(item.id, "publico")}
                                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                    item.visibilidad === "publico" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                                  }`}
                                >
                                  {labels.public}
                                </button>
                            </div>
                            {item.nombre !== AUTO_MINIFIG_MISSING_LIST_NAME ? (
                              <button
                                type="button"
                                onClick={() => openDeleteListaConfirm(item)}
                                className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700"
                              >
                                {labels.deleteList}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>

          {showOffersGivenPanel ? (
            <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowOffersGivenPanel(false)}>
              <div className="w-full max-w-[560px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-boogaloo text-xl text-slate-900">{labels.offeredToOthers}</p>
                    <button
                      type="button"
                      onClick={() => printOffersSummary(labels.offeredToOthers, offersGivenRows)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                    >
                      {labels.print}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOffersGivenPanel(false)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                  >
                    {labels.close}
                  </button>
                </div>
                <div className="mt-3 max-h-[360px] overflow-auto space-y-2">
                  {offersPanelsLoading ? (
                    <p className="text-sm text-slate-500">{labels.loading}</p>
                  ) : offersGivenRows.length === 0 ? (
                    <p className="text-sm text-slate-500">{labels.noOffersRegistered}</p>
                  ) : (
                    offersGivenRows.map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{row.userName}</p>
                          <p className="truncate text-xs text-slate-600">{row.partLabel}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{row.quantity}</p>
                          <button
                            type="button"
                            onClick={() => void releaseOfferFromGivenPanel(row.id)}
                            className="rounded-md border border-red-300 px-2 py-0.5 text-[10px] font-semibold text-red-700"
                          >
                            Liberar oferta
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {showOffersReceivedPanel ? (
            <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowOffersReceivedPanel(false)}>
              <div className="w-full max-w-[560px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-boogaloo text-xl text-slate-900">{labels.offeredToMe}</p>
                    <button
                      type="button"
                      onClick={() => printOffersSummary(labels.offeredToMe, offersReceivedRows)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                    >
                      {labels.print}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOffersReceivedPanel(false)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                  >
                    {labels.close}
                  </button>
                </div>
                <div className="mt-3 max-h-[360px] overflow-auto space-y-2">
                  {offersPanelsLoading ? (
                    <p className="text-sm text-slate-500">{labels.loading}</p>
                  ) : offersReceivedRows.length === 0 ? (
                    <p className="text-sm text-slate-500">{labels.noOffersReceived}</p>
                  ) : (
                    offersReceivedRows.map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{row.userName}</p>
                          <p className="truncate text-xs text-slate-600">{row.partLabel}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{row.quantity}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {showCreateListaPanel ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowCreateListaPanel(false)}>
              <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewListaTipo("deseos")}
                    className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                      newListaTipo === "deseos" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                    }`}
                  >
                    {labels.wishlistListType}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewListaTipo("venta")}
                    className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                      newListaTipo === "venta" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                    }`}
                  >
                    {labels.saleListType}
                  </button>
                </div>

                <label className="block text-sm text-slate-700">{labels.name}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={newListaNombre}
                    onChange={(event) => setNewListaNombre(event.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder={labels.listNamePlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => void createListaItem()}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {labels.createList}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showRenameListaPanel && listaToRename ? (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4"
              onClick={() => {
                setShowRenameListaPanel(false);
                setListaToRename(null);
                setRenameListaInput("");
              }}
            >
              <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                <h3 className="text-lg font-semibold text-slate-900">{labels.renameList}</h3>
                <label className="mt-3 block text-sm text-slate-700">{labels.name}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={renameListaInput}
                    onChange={(event) => setRenameListaInput(event.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder={labels.listNamePlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => void saveRenameLista()}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {labels.save}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showDeleteListaConfirmPanel && listaToDelete ? (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-4"
              onClick={() => {
                setShowDeleteListaConfirmPanel(false);
                setListaToDelete(null);
              }}
            >
              <div className="w-full max-w-[420px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
                <div className="mb-3 flex justify-center">
                  <Image
                    src="/api/avatar/LEGO-ICON_A.svg"
                    alt="LEGO icon"
                    width={96}
                    height={96}
                    unoptimized
                    className="h-24 w-24 object-contain"
                  />
                </div>
                <p className="text-center text-sm text-slate-900">
                  {labels.deleteListConfirm}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteListaConfirmPanel(false);
                      setListaToDelete(null);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    {labels.no}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteListaConfirmed()}
                    className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700"
                  >
                    {labels.yes}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showLoaderPopup ? (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/20 p-4">
              <div className="w-[140px] rounded-xl border p-2 shadow-xl" style={{ backgroundColor: uiColor1, borderColor: uiColor3 }}>
                <div className="rounded-lg bg-white p-1">
                  <Lottie animationData={loaderAnimationData} loop autoplay className="h-20 w-full" />
                </div>
              </div>
            </div>
          ) : null}
        </main>
      );
    }

    if (activeSection === "configuracion_personal") {
      return (
        <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
          <div className="relative mx-auto w-full max-w-[800px] rounded-2xl border-[10px] p-[1px] shadow-xl" style={{ borderColor: uiColor1 }}>
            {unreadChatsFloatingAlert}
            {unreadChatsPopupOverlay}
            {memberChatPopupOverlay}
            {deleteUserConfirmPopupOverlay}
            <div className="rounded-xl border-[5px] bg-white p-4 sm:p-8" style={{ borderColor: currentLugColor2 || "#ffffff", backgroundColor: "#ffffff" }}>
              <header>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-boogaloo text-3xl font-semibold text-slate-900">{labels.userSettings}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      navigateSectionClient("dashboard", "/dashboard");
                    }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    {labels.back}
                  </button>
                </div>
                <div className="mt-3 h-[5px] w-full rounded-full" style={{ backgroundColor: currentLugColor2 || "#ffffff" }} />
              </header>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                <div className="mt-1 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFace(selectedFace);
                      setShowFacePicker(true);
                    }}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 p-1"
                  >
                    <Image
                      src={getFaceImagePath(selectedFace)}
                      alt={`Cara ${selectedFace}`}
                      width={56}
                      height={56}
                      unoptimized
                      className="h-full w-full object-contain"
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <label className="block text-sm text-slate-700">{labels.name}</label>
                    <input
                      type="text"
                      value={settingsNameInput}
                      onChange={(event) => setSettingsNameInput(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>

                <label className="mt-3 block text-sm text-slate-700">{labels.mail}</label>
                <input
                  type="email"
                  value={settingsEmailInput}
                  onChange={(event) => setSettingsEmailInput(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />

                <button
                  type="button"
                  onClick={() => setShowPasswordFields((prev) => !prev)}
                  className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {showPasswordFields ? labels.hidePasswordChange : labels.changePassword}
                </button>

                {showPasswordFields ? (
                  <>
                    <label className="mt-3 block text-sm text-slate-700">{labels.newPassword}</label>
                    <input
                      type="password"
                      value={settingsPasswordInput}
                      onChange={(event) => setSettingsPasswordInput(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                    <label className="mt-3 block text-sm text-slate-700">{labels.repeatPassword}</label>
                    <input
                      type="password"
                      value={settingsPasswordConfirmInput}
                      onChange={(event) => setSettingsPasswordConfirmInput(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </>
                ) : null}

                <label className="mt-3 block text-sm text-slate-700">{labels.lug}</label>
                <button
                  type="button"
                  onClick={() => void openSettingsLugPanel()}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-left"
                >
                  {settingsLugName}
                  {rolLug === "admin" ? " (admin)" : ""}
                </button>

                <label className="mt-3 block text-sm text-slate-700">{labels.socialNetwork}</label>
                <div className="mt-1 grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                  <select
                    value={settingsSocialPlatform}
                    onChange={(event) => setSettingsSocialPlatform(event.target.value as SocialPlatform)}
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="">{labels.none}</option>
                  </select>
                  <input
                    type="text"
                    value={settingsSocialHandle}
                    onChange={(event) => setSettingsSocialHandle(event.target.value)}
                    placeholder={labels.userPlaceholder}
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <label className="mt-3 block text-sm text-slate-700">Brickset</label>
                <div className="mt-1 rounded-lg border border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">Conectá Brickset desde Balance de usuario.</p>
                  <p className="mt-1 text-sm text-slate-800">{settingsBricksetUsername ? `Conectado como ${settingsBricksetUsername}` : "Sin conectar"}</p>
                </div>

                <label className="mt-3 block text-sm text-slate-700">{t.language}</label>
                <select
                  value={settingsLanguageInput}
                  onChange={(event) => setSettingsLanguageInput(event.target.value as UiLanguage)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  {uiLanguages.map((option) => (
                    <option key={option} value={option}>
                      {uiLanguageLabels[option]}
                    </option>
                  ))}
                </select>

                {showFacePicker ? (
                  <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
                    onClick={() => setShowFacePicker(false)}
                  >
                    <div className="w-full max-w-sm rounded-xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
                      <p className="text-sm text-slate-700">{labels.doubleClickSelect}</p>
                      <div className="mt-3 grid grid-cols-5 gap-1.5">
                        {Array.from({ length: FACE_TOTAL }, (_, index) => {
                          const faceNum = index + 1;
                          const isPreview = previewFace === faceNum;
                          return (
                            <button
                              key={faceNum}
                              type="button"
                              onClick={() => {
                                setSelectedFace(faceNum);
                                setPreviewFace(faceNum);
                                setShowFacePicker(false);
                              }}
                              className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border p-0.5 ${isPreview ? "border-[#006eb2] bg-[#cfeeff]" : "border-slate-200 bg-slate-50"}`}
                            >
                              <Image
                                src={getFaceImagePath(faceNum)}
                                alt={`Cara ${faceNum}`}
                                width={52}
                                height={52}
                                unoptimized
                                className="h-full w-full object-contain"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteUserConfirmPopup(true)}
                    className="mr-auto rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700"
                  >
                    Desarmar usuario
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFacePicker(false);
                      setShowPasswordFields(false);
                      setSettingsPasswordInput("");
                      setSettingsPasswordConfirmInput("");
                      navigateSectionClient("dashboard", "/dashboard");
                    }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                  >
                    {labels.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveUserSettings()}
                    disabled={settingsSaving}
                    className="rounded-md border px-4 py-2 text-sm font-semibold"
                    style={{
                      backgroundColor: uiColor1,
                      color: uiColor1Text,
                      borderColor: uiColor3,
                    }}
                  >
                    {settingsSaving ? labels.saving : labels.save}
                  </button>
                </div>
              </div>
              </div>
            </div>

            {showSettingsLugPanel ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowSettingsLugPanel(false)}>
                <div
                  className={`w-full rounded-xl bg-white p-5 shadow-xl ${rolLug === "admin" ? "max-w-[520px]" : "max-w-[320px]"}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-boogaloo text-xl text-slate-900">{rolLug === "admin" ? labels.lugProperties : labels.lugInformation}</h3>
                    <button
                      type="button"
                      onClick={() => setShowSettingsLugPanel(false)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                    >
                      {labels.close}
                    </button>
                  </div>

                  {settingsLugPanelLoading ? (
                    <p className="mt-4 text-sm text-slate-600">{labels.loadingLugInfo}</p>
                  ) : (
                    <>
                      {rolLug === "admin" ? (
                        <div className="mt-4 space-y-3">
                          <div>
                            <label className="block text-sm text-slate-700">{labels.logo}</label>
                            <input
                              type="file"
                              accept="image/png,image/jpeg"
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                void handleSettingsLugLogoFileChange(file);
                              }}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            {settingsLugLogoDataUrl ? (
                              <Image
                                src={settingsLugLogoDataUrl}
                                alt={settingsLugNombreInput || settingsLugName}
                                width={80}
                                height={80}
                                unoptimized
                                className="mt-2 h-20 w-20 rounded-md border border-slate-200 object-cover"
                              />
                            ) : null}
                            {settingsLugLogoError ? <p className="mt-1 text-xs text-red-600">{settingsLugLogoError}</p> : null}
                          </div>

                          <div>
                            <label className="block text-sm text-slate-700">{labels.name}</label>
                            <input
                              type="text"
                              value={settingsLugNombreInput}
                              onChange={(event) => setSettingsLugNombreInput(event.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-700">{labels.countryCity}</label>
                            <input
                              type="text"
                              value={settingsLugPaisInput}
                              onChange={(event) => setSettingsLugPaisInput(event.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-700">{labels.description}</label>
                            <textarea
                              value={settingsLugDescripcionInput}
                              onChange={(event) => setSettingsLugDescripcionInput(event.target.value)}
                              rows={3}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center gap-2">
                              <input
                                type="color"
                                value={toColorPickerValue(settingsLugColor1Input, "#006eb2")}
                                onChange={(event) => setSettingsLugColor1Input(event.target.value)}
                                className="h-12 w-12 rounded-md border border-slate-300 bg-white p-1"
                              />
                              <input
                                type="text"
                                value={settingsLugColor1Input}
                                onChange={(event) => setSettingsLugColor1Input(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-sm"
                              />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                              <input
                                type="color"
                                value={toColorPickerValue(settingsLugColor2Input, "#ffffff")}
                                onChange={(event) => setSettingsLugColor2Input(event.target.value)}
                                className="h-12 w-12 rounded-md border border-slate-300 bg-white p-1"
                              />
                              <input
                                type="text"
                                value={settingsLugColor2Input}
                                onChange={(event) => setSettingsLugColor2Input(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-sm"
                              />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                              <input
                                type="color"
                                value={toColorPickerValue(settingsLugColor3Input, "#111111")}
                                onChange={(event) => setSettingsLugColor3Input(event.target.value)}
                                className="h-12 w-12 rounded-md border border-slate-300 bg-white p-1"
                              />
                              <input
                                type="text"
                                value={settingsLugColor3Input}
                                onChange={(event) => setSettingsLugColor3Input(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <div className="mx-auto h-32 w-32 overflow-hidden rounded-md border border-slate-200 bg-white">
                            {settingsLugLogoDataUrl ? (
                              <Image
                                src={settingsLugLogoDataUrl}
                                alt={settingsLugNombreInput || settingsLugName}
                                width={128}
                                height={128}
                                unoptimized
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <p className="mt-3 text-lg font-semibold text-slate-900">{settingsLugNombreInput || labels.noLug}</p>
                          <p className="text-sm text-slate-600">{settingsLugPaisInput || labels.noCountry}</p>
                          <p className="mt-3 text-sm text-slate-700">{settingsLugDescripcionInput || labels.noDescription}</p>
                        </div>
                      )}

                      <div className="mt-4 flex justify-end gap-2">
                        {rolLug === "admin" ? (
                          <button
                            type="button"
                            onClick={() => void saveSettingsLugPanel()}
                            disabled={settingsLugSaving}
                            className="rounded-md border px-4 py-2 text-sm font-semibold"
                            style={{
                              backgroundColor: uiColor1,
                              color: uiColor1Text,
                              borderColor: uiColor3,
                            }}
                          >
                            {settingsLugSaving ? labels.saving : labels.save}
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {showLugInfoPanel ? (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowLugInfoPanel(false)}>
                <div className="w-full max-w-[560px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-boogaloo text-2xl text-slate-900">{labels.lugInformation}</h3>
                    <button
                      type="button"
                      onClick={() => setShowLugInfoPanel(false)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                    >
                      {labels.close}
                    </button>
                  </div>
                  {lugInfoLoading ? (
                    <p className="mt-4 text-sm text-slate-600">{labels.loadingLugInfo}</p>
                  ) : lugInfoData ? (
                    <div className="mt-3">
                      <p className="text-lg font-semibold text-slate-900">{lugInfoData.nombre || labels.noName}</p>
                      <p className="text-sm text-slate-600">{lugInfoData.pais || labels.noCountry}</p>
                      <p className="mt-3 text-sm text-slate-700">{lugInfoData.descripcion || labels.noDescription}</p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-600">{labels.noLugDetail}</p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-2 w-full px-2 text-center">
              <p className="mx-auto inline-block px-2 text-xs font-semibold tracking-wide" style={{ color: "#a8a8a8" }}>
                {footerLegend || "LUGs App"}
            </p>
          </div>
        </main>
      );
    }

    return (
      <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-[800px]">
          {isMaster ? (
            <button
              type="button"
              className="mb-3 w-full rounded-lg bg-black px-4 py-2 text-left text-sm font-semibold text-white"
              onClick={() => {
                setShowMasterPanel(true);
                setMaintenanceDraftFooterLegend(footerLegend);
                void loadMasterLugs();
              }}
            >
              Master
            </button>
          ) : null}

          <div className="relative rounded-2xl border-[10px] p-[1px] shadow-xl" style={{ borderColor: uiColor1 }}>
          {unreadChatsFloatingAlert}
          {unreadChatsPopupOverlay}
          {memberChatPopupOverlay}
          {deleteUserConfirmPopupOverlay}
          <div className="rounded-xl border-[5px] bg-white p-4 sm:p-8" style={{ borderColor: currentLugColor2 || "#ffffff", backgroundColor: "#ffffff" }}>
          <header className="pb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Image
                  src={getFaceImagePath(selectedFace)}
                  alt="Avatar"
                  width={80}
                  height={80}
                  unoptimized
                  className="h-20 w-20 object-contain"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-boogaloo break-all text-3xl font-semibold text-slate-900 sm:text-5xl">{displayName}</h1>
                    <button
                      type="button"
                      onClick={() => setShowLanguagePickerPopup(true)}
                      className="inline-flex h-8 min-w-8 items-center justify-center"
                      title={uiLanguageLabels[language]}
                      aria-label={t.language}
                    >
                      <Image src={activeLanguageIconSrc} alt={uiLanguageLabels[language]} width={22} height={22} unoptimized className="h-[22px] w-[22px] object-contain" />
                    </button>
                    {isMaster && masterEmptyNotificationsCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => void openMasterEmptyLugsPanel()}
                        className="relative rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700"
                        title="LUGs vacíos"
                        aria-label="LUGs vacíos"
                      >
                        <span className="text-base">✉</span>
                        <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">
                          {masterEmptyNotificationsCount}
                        </span>
                      </button>
                    ) : null}
                    {rolLug === "admin" && adminPendingRequestsCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => void openAdminRequestsPanel()}
                        className="relative rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700"
                        title="Solicitudes de ingreso"
                        aria-label="Solicitudes de ingreso"
                      >
                        <span className="text-base">✉</span>
                        <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">
                          {adminPendingRequestsCount}
                        </span>
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-black">
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loading}
                      className="rounded-md border border-black/20 px-3 py-1 text-sm"
                    >
                      {t.logout}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 h-[5px] w-full rounded-full" style={{ backgroundColor: currentLugColor2 || "#ffffff" }} />

            <div className="mt-3 grid w-full grid-cols-1 items-start gap-3 min-[800px]:grid-cols-3">
              <div className="grid w-full grid-cols-1 content-start gap-3 self-start min-[800px]:col-span-2">
                <button
                  type="button"
                  onClick={() => void openUserSettings({ mode: "page", navigate: true })}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2 text-left"
                  title="Configuración personal"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">Configuración personal</p>
                  </div>
                </button>

                {showDashboardBalanceRow ? (
                  <button
                    type="button"
                    onClick={() => setActiveSection("balance_usuario")}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2 text-left"
                    title="Balance de usuario"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">Balance de usuario</p>
                    </div>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => router.push("/chats")}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2 text-left"
                  title="Mensajes"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">Mensajes</p>
                  </div>
                </button>

                {showDashboardListasRow ? (
                  <button
                    type="button"
                    onClick={() => {
                      void openListasSection();
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2 text-left"
                    title="Listas"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">Mis listas</p>
                      <p className="text-sm text-slate-600">{`${totalListasCreated} listas creadas`}</p>
                    </div>
                  </button>
                ) : null}

                {showDashboardSetsRow ? (
                  <button
                    type="button"
                    onClick={() => setStatus("Sets disponible próximamente.")}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2 text-left"
                    title="Sets"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">Mis sets</p>
                      <p className="text-sm text-slate-600">Coleccion y wishlist de sets</p>
                    </div>
                  </button>
                ) : null}

                {showDashboardMinifigRow ? (
                  <button
                    type="button"
                    onClick={() => {
                      void openMinifigurasSection();
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">Mis minfiguras</p>
                      <p className="text-sm text-slate-600">Colección y seguimiento de tus CMF</p>
                    </div>
                  </button>
                ) : null}
              </div>

              <div className="flex w-full flex-col gap-2 min-[800px]:col-span-1">
                <button
                  type="button"
                  onClick={() => {
                    navigateSectionClient("mi_lug", "/mi-lug");
                  }}
                  className="flex aspect-[5/3] w-full items-center justify-center rounded-lg border-2 bg-white text-center text-xs font-semibold text-slate-700"
                  style={{ borderColor: currentLugColor2 || "#ffffff" }}
                  title="Mi LUG"
                >
                  {currentLugLogoDataUrl || currentUserLug?.logo_data_url ? (
                    <Image
                      src={currentLugLogoDataUrl || currentUserLug?.logo_data_url || ""}
                      alt={currentUserLug?.nombre || "Logo LUG"}
                      width={200}
                      height={200}
                      unoptimized
                      className="h-[88%] w-[88%] object-contain"
                    />
                  ) : (
                    "X"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowLugsPanel(true);
                    void loadMasterLugs();
                    if (userId) {
                      void loadMyJoinRequests(userId);
                    }
                  }}
                  className="flex aspect-[5/3] w-full flex-col items-center justify-center rounded-lg border-2 bg-white"
                  style={{ borderColor: currentLugColor2 || "#ffffff" }}
                  title="Ver LUGs"
                >
                  <div className="relative flex h-[88%] w-[88%] items-center justify-center">
                    <Image
                      src="/api/avatar/Mundo.png?v=20260314"
                      alt="Ver LUGs"
                      width={200}
                      height={200}
                      unoptimized
                      className="h-full w-full object-contain"
                    />
                    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-cubano-title text-xl font-semibold tracking-wide text-black">
                      <span className="relative inline-block">
                        <span className="absolute inset-0 text-transparent" style={{ WebkitTextStroke: "3px #ffffff" }} aria-hidden>
                          LUGs
                        </span>
                        <span className="relative text-black">{labels.buttonLugs}</span>
                      </span>
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </header>
          </div>
          </div>

        {showUserSettings ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
              <h3 className="font-boogaloo text-xl text-slate-900">{labels.userSettings}</h3>

              <div className="mt-4 flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewFace(selectedFace);
                    setShowFacePicker(true);
                  }}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 p-1"
                >
                  <Image
                    src={getFaceImagePath(selectedFace)}
                    alt={`Cara ${selectedFace}`}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <label className="block text-sm text-slate-700">{labels.name}</label>
                  <input
                    type="text"
                    value={settingsNameInput}
                    onChange={(event) => setSettingsNameInput(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <label className="mt-3 block text-sm text-slate-700">{labels.mail}</label>
              <input
                type="email"
                value={settingsEmailInput}
                onChange={(event) => setSettingsEmailInput(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />

              <button
                type="button"
                onClick={() => setShowPasswordFields((prev) => !prev)}
                className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {showPasswordFields ? labels.hidePasswordChange : labels.changePassword}
              </button>

              {showPasswordFields ? (
                <>
                  <label className="mt-3 block text-sm text-slate-700">{labels.newPassword}</label>
                  <input
                    type="password"
                    value={settingsPasswordInput}
                    onChange={(event) => setSettingsPasswordInput(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <label className="mt-3 block text-sm text-slate-700">{labels.repeatPassword}</label>
                  <input
                    type="password"
                    value={settingsPasswordConfirmInput}
                    onChange={(event) => setSettingsPasswordConfirmInput(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </>
              ) : null}

              <label className="mt-3 block text-sm text-slate-700">{labels.lug}</label>
              <button
                type="button"
                onClick={() => void openSettingsLugPanel()}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-left"
              >
                {settingsLugName}
                {rolLug === "admin" ? " (admin)" : ""}
              </button>

              <label className="mt-3 block text-sm text-slate-700">{labels.socialNetwork}</label>
              <div className="mt-1 grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                <select
                  value={settingsSocialPlatform}
                  onChange={(event) => setSettingsSocialPlatform(event.target.value as SocialPlatform)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="">{labels.none}</option>
                </select>
                <input
                  type="text"
                  value={settingsSocialHandle}
                  onChange={(event) => setSettingsSocialHandle(event.target.value)}
                  placeholder={labels.userPlaceholder}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <label className="mt-3 block text-sm text-slate-700">Brickset</label>
              <div className="mt-1 rounded-lg border border-slate-300 bg-slate-50 p-3">
                <p className="text-xs text-slate-600">Conectá Brickset desde Balance de usuario.</p>
                <p className="mt-1 text-sm text-slate-800">{settingsBricksetUsername ? `Conectado como ${settingsBricksetUsername}` : "Sin conectar"}</p>
              </div>

              <label className="mt-3 block text-sm text-slate-700">{t.language}</label>
              <select
                value={settingsLanguageInput}
                onChange={(event) => setSettingsLanguageInput(event.target.value as UiLanguage)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {uiLanguages.map((option) => (
                  <option key={option} value={option}>
                    {uiLanguageLabels[option]}
                  </option>
                ))}
              </select>

              {showFacePicker ? (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
                  onClick={() => setShowFacePicker(false)}
                >
                  <div className="w-full max-w-sm rounded-xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
                    <p className="text-sm text-slate-700">{labels.doubleClickSelect}</p>
                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                      {Array.from({ length: FACE_TOTAL }, (_, index) => {
                        const faceNum = index + 1;
                        const isPreview = previewFace === faceNum;
                        return (
                          <button
                            key={faceNum}
                            type="button"
                            onClick={() => {
                              setSelectedFace(faceNum);
                              setPreviewFace(faceNum);
                              setShowFacePicker(false);
                            }}
                            className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border p-0.5 ${isPreview ? "border-[#006eb2] bg-[#cfeeff]" : "border-slate-200 bg-slate-50"}`}
                          >
                            <Image
                              src={getFaceImagePath(faceNum)}
                              alt={`Cara ${faceNum}`}
                              width={52}
                              height={52}
                              unoptimized
                              className="h-full w-full object-contain"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteUserConfirmPopup(true)}
                  className="mr-auto rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700"
                >
                  Desarmar usuario
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFacePicker(false);
                    setShowPasswordFields(false);
                    setSettingsPasswordInput("");
                    setSettingsPasswordConfirmInput("");
                    setShowUserSettings(false);
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                >
                  {labels.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => void saveUserSettings()}
                  disabled={settingsSaving}
                  className="rounded-md border px-4 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: uiColor1,
                    color: uiColor1Text,
                    borderColor: uiColor3,
                  }}
                >
                  {settingsSaving ? labels.saving : labels.save}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showSettingsLugPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowSettingsLugPanel(false)}>
            <div
              className={`w-full rounded-xl bg-white p-5 shadow-xl ${rolLug === "admin" ? "max-w-[500px]" : "max-w-[300px]"}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-boogaloo text-xl text-slate-900">
                  {rolLug === "admin" ? labels.lugProperties : labels.lugInformation}
                </h3>
                {rolLug === "admin" ? (
                  <button
                    type="button"
                    onClick={() => setShowSettingsLugPanel(false)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                  >
                    {labels.close}
                  </button>
                ) : null}
              </div>

              {settingsLugPanelLoading ? (
                <p className="mt-4 text-sm text-slate-600">{labels.loadingLugInfo}</p>
              ) : (
                <>
                  {rolLug !== "admin" ? (
                    <div className="mx-auto mt-4 w-full max-w-[250px] rounded-lg border border-slate-300 bg-slate-50 p-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-5">
                        <div className="mx-auto h-40 w-40 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          {settingsLugLogoDataUrl ? (
                            <Image
                              src={settingsLugLogoDataUrl}
                              alt={settingsLugNombreInput || settingsLugName}
                              width={160}
                              height={160}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>

                        <div className="mt-4 text-center">
                          <p className="text-xl font-semibold text-slate-900">{settingsLugNombreInput || labels.noLug}</p>
                          <p className="mt-1 text-sm text-slate-600">{settingsLugPaisInput || labels.noCountry}</p>
                          <p className="mx-auto mt-4 max-w-[420px] text-sm leading-6 text-slate-700">{settingsLugDescripcionInput || labels.noDescription}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto mt-4 w-full max-w-[500px] space-y-3">
                      <div>
                        <label className="block text-sm text-slate-700">{labels.logo}</label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            void handleSettingsLugLogoFileChange(file);
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        {settingsLugLogoDataUrl ? (
                          <Image
                            src={settingsLugLogoDataUrl}
                            alt={settingsLugNombreInput || settingsLugName}
                            width={80}
                            height={80}
                            unoptimized
                            className="mt-2 h-20 w-20 rounded-md border border-slate-200 object-cover"
                          />
                        ) : null}
                        {settingsLugLogoError ? <p className="mt-1 text-xs text-red-600">{settingsLugLogoError}</p> : null}
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700">{labels.name}</label>
                        <input
                          type="text"
                          value={settingsLugNombreInput}
                          onChange={(event) => setSettingsLugNombreInput(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700">{labels.countryCity}</label>
                        <input
                          type="text"
                          value={settingsLugPaisInput}
                          onChange={(event) => setSettingsLugPaisInput(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700">{labels.description}</label>
                        <textarea
                          value={settingsLugDescripcionInput}
                          onChange={(event) => setSettingsLugDescripcionInput(event.target.value)}
                          rows={3}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center gap-2">
                          <input
                            type="color"
                            value={toColorPickerValue(settingsLugColor1Input, "#006eb2")}
                            onChange={(event) => setSettingsLugColor1Input(event.target.value)}
                            className="h-12 w-12 rounded-md border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={settingsLugColor1Input}
                            onChange={(event) => setSettingsLugColor1Input(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-sm"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <input
                            type="color"
                            value={toColorPickerValue(settingsLugColor2Input, "#ffffff")}
                            onChange={(event) => setSettingsLugColor2Input(event.target.value)}
                            className="h-12 w-12 rounded-md border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={settingsLugColor2Input}
                            onChange={(event) => setSettingsLugColor2Input(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-sm"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <input
                            type="color"
                            value={toColorPickerValue(settingsLugColor3Input, "#111111")}
                            onChange={(event) => setSettingsLugColor3Input(event.target.value)}
                            className="h-12 w-12 rounded-md border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={settingsLugColor3Input}
                            onChange={(event) => setSettingsLugColor3Input(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`mt-4 flex gap-2 ${rolLug === "admin" ? "justify-end" : "justify-center"}`}>
                    {rolLug !== "admin" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSettingsLugPanel(false);
                          setShowLugsPanel(true);
                          void loadMasterLugs();
                        }}
                        className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white"
                      >
                        {labels.switchLug}
                      </button>
                    ) : null}
                    {rolLug === "admin" ? (
                      <button
                        type="button"
                        onClick={() => setShowSettingsLugPanel(false)}
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                      >
                        {labels.close}
                      </button>
                    ) : null}
                    {rolLug === "admin" ? (
                      <button
                        type="button"
                        onClick={() => void saveSettingsLugPanel()}
                        disabled={settingsLugSaving}
                        className="rounded-md border px-4 py-2 text-sm font-semibold"
                        style={{
                          backgroundColor: uiColor1,
                          color: uiColor1Text,
                          borderColor: uiColor3,
                        }}
                      >
                        {settingsLugSaving ? labels.saving : labels.save}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {showMasterPanel ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowMasterPanel(false)}>
            <div className="w-full max-w-[700px] max-h-[700px] overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900" style={{ fontFamily: "var(--font-chewy), cursive" }}>
                  {labels.masterPanel}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMasterPanel(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  {labels.close}
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900" style={{ fontFamily: "var(--font-chewy), cursive" }}>
                    LUGs
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateLugFromListFlow(false);
                      setShowCreateLugConfirmPanel(false);
                      setLugLogoFile(null);
                      setLugLogoDataUrl(null);
                      setLugLogoError("");
                      setShowCreateLugPanel(true);
                    }}
                    className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white"
                  >
                    {labels.createLug}
                  </button>
                </div>

                <div className="mt-3 max-h-[320px] overflow-auto rounded-md border border-slate-200 p-2">
                  <p className="mb-2 text-xs text-slate-500">{labels.doubleClickAssignLug}</p>
                  {masterLugsLoading ? (
                    <p className="text-sm text-slate-600">{labels.loadingLugs}</p>
                  ) : masterLugs.length === 0 ? (
                    <p className="text-sm text-slate-500">{labels.noLugsLoaded}</p>
                  ) : (
                    <ul className="space-y-2">
                      {masterLugs.map((lug) => (
                        <li
                          key={lug.lug_id}
                          onDoubleClick={() => void assignCurrentLug(lug.lug_id)}
                          className={`flex cursor-pointer items-center gap-3 rounded-md border p-2 ${
                            currentLugId === lug.lug_id ? "border-[#006eb2] bg-[#eaf6ff]" : "border-slate-200"
                          }`}
                        >
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                            {lug.logo_data_url ? (
                              <Image
                                src={lug.logo_data_url}
                                alt={lug.nombre}
                                width={44}
                                height={44}
                                unoptimized
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{lug.nombre}</p>
                            <p className="truncate text-xs text-slate-600">{lug.pais ?? labels.noCountry}</p>
                          </div>
                          <p className="text-xs text-slate-700">{`${lug.members_count} ${labels.membersSuffix}`}</p>
                          {lug.open_access ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteOpenLugFromMaster(lug.lug_id, lug.nombre);
                              }}
                              disabled={masterLugActionLoadingId === lug.lug_id}
                              className="ml-2 rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700"
                            >
                              {masterLugActionLoadingId === lug.lug_id ? "Borrando..." : "Borrar"}
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900" style={{ fontFamily: "var(--font-chewy), cursive" }}>
                    {labels.maintenanceSection}
                  </h4>
                  <div className="mt-3 flex flex-wrap items-center justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLoadingPhrasesDraft([...loadingPhrases]);
                        setShowLoadingPhrasesPanel(true);
                      }}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      {labels.loadingPhrasesTitle}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (maintenanceEnabled) {
                          void disableMaintenanceMode();
                        } else {
                          openMaintenancePanel();
                        }
                      }}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      {maintenanceEnabled ? labels.disableMaintenance : labels.maintenanceLockTitle}
                    </button>
                  </div>

                  <div className="mt-3">
                    <label className="block text-sm text-slate-700">{labels.footerLegendLabel}</label>
                    <div className="mt-1">
                      <input
                        type="text"
                        value={maintenanceDraftFooterLegend}
                        onChange={(event) => setMaintenanceDraftFooterLegend(event.target.value)}
                        placeholder={labels.footerLegendPlaceholder}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => void saveFooterLegendInMaster()}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                      >
                        {labels.footerLegendSave}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900" style={{ fontFamily: "var(--font-chewy), cursive" }}>
                    Secciones
                  </h4>

                  <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <span className="text-sm text-slate-800">Balance</span>
                    <button
                      type="button"
                      onClick={() =>
                        void saveDashboardSectionsInMaster({
                          show_balance: !dashboardSectionBalanceEnabled,
                          show_listas: dashboardSectionListasEnabled,
                          show_sets: dashboardSectionSetsEnabled,
                          show_minifiguras: dashboardSectionMinifigEnabled,
                        })
                      }
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        dashboardSectionBalanceEnabled ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      {dashboardSectionBalanceEnabled ? "ON" : "OFF"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <span className="text-sm text-slate-800">Listas</span>
                    <button
                      type="button"
                      onClick={() =>
                        void saveDashboardSectionsInMaster({
                          show_balance: dashboardSectionBalanceEnabled,
                          show_listas: !dashboardSectionListasEnabled,
                          show_sets: dashboardSectionSetsEnabled,
                          show_minifiguras: dashboardSectionMinifigEnabled,
                        })
                      }
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        dashboardSectionListasEnabled ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      {dashboardSectionListasEnabled ? "ON" : "OFF"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <span className="text-sm text-slate-800">Sets</span>
                    <button
                      type="button"
                      onClick={() =>
                        void saveDashboardSectionsInMaster({
                          show_balance: dashboardSectionBalanceEnabled,
                          show_listas: dashboardSectionListasEnabled,
                          show_sets: !dashboardSectionSetsEnabled,
                          show_minifiguras: dashboardSectionMinifigEnabled,
                        })
                      }
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        dashboardSectionSetsEnabled ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      {dashboardSectionSetsEnabled ? "ON" : "OFF"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <span className="text-sm text-slate-800">Minifiguras</span>
                    <button
                      type="button"
                      onClick={() =>
                        void saveDashboardSectionsInMaster({
                          show_balance: dashboardSectionBalanceEnabled,
                          show_listas: dashboardSectionListasEnabled,
                          show_sets: dashboardSectionSetsEnabled,
                          show_minifiguras: !dashboardSectionMinifigEnabled,
                        })
                      }
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        dashboardSectionMinifigEnabled ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      {dashboardSectionMinifigEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        ) : null}

        {showLoadingPhrasesPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowLoadingPhrasesPanel(false)}>
            <div className="w-full max-w-[560px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <h3 className="text-xl text-slate-900">{labels.loadingPhrasesTitle}</h3>
              <p className="mt-1 text-sm text-slate-600">{labels.loadingPhrasesHelp}</p>

              <div className="mt-4 space-y-2">
                {DEFAULT_LOADING_PHRASES.map((_phrase, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-slate-500">•</span>
                    <input
                      type="text"
                      value={loadingPhrasesDraft[index] ?? ""}
                      onChange={(event) => {
                        const next = [...loadingPhrasesDraft];
                        next[index] = event.target.value;
                        setLoadingPhrasesDraft(next);
                      }}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoadingPhrasesPanel(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                >
                  {labels.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => saveLoadingPhrases(loadingPhrasesDraft)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  {labels.save}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showMaintenancePanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowMaintenancePanel(false)}>
            <div className="w-full max-w-[620px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">{labels.maintenanceLockTitle}</h3>
                <button
                  type="button"
                  onClick={() => void activateMaintenanceMode()}
                  className="rounded-md border px-4 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: uiColor1,
                    color: uiColor1Text,
                    borderColor: uiColor3,
                  }}
                >
                  {labels.enableMaintenance}
                </button>
              </div>

              <label className="block text-sm text-slate-700">{labels.maintenanceLine1}</label>
              <input
                type="text"
                value={maintenanceDraftMessageLine1}
                onChange={(event) => setMaintenanceDraftMessageLine1(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder={labels.maintenanceLine1Placeholder}
              />

              <label className="mt-3 block text-sm text-slate-700">{labels.maintenanceLine2}</label>
              <input
                type="text"
                value={maintenanceDraftMessageLine2}
                onChange={(event) => setMaintenanceDraftMessageLine2(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder={labels.maintenanceLine2Placeholder}
              />

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.preview}</p>
              <div className="bg-lego-tile mt-2 min-h-[280px] rounded-lg p-4">
                <div className="flex min-h-[248px] flex-col items-center justify-center gap-3">
                  <Image
                    src="/api/avatar/Constructor.png"
                    alt="Constructor"
                    width={140}
                    height={140}
                    unoptimized
                    className="h-[140px] w-[140px] object-contain"
                  />
                  <div className="space-y-2 text-center">
                    <p className="font-cubano-title text-2xl font-semibold text-white">
                      {maintenanceDraftMessageLine1.trim() || "Estamos en mantenimiento"}
                    </p>
                    <p className="font-cubano-title text-xl font-semibold text-white">
                      {maintenanceDraftMessageLine2.trim() || "Volvé en un rato"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showLugsPanel ? (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4"
            onClick={() => {
              if (!mustSelectLugOnDashboard) {
                setShowLugsPanel(false);
              }
            }}
          >
            <div className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-boogaloo text-xl text-slate-900">{labels.lugsList}</h3>
              </div>
              {mustSelectLugOnDashboard ? <p className="mt-1 text-xs font-semibold text-slate-600">{labels.mustJoinOrCreateLug}</p> : null}

              <div className="mt-3 rounded-md border border-slate-200 p-2">
                <p className="mb-2 text-xs text-slate-500">{labels.doubleClickLugInfo}</p>
                {masterLugsLoading ? (
                  <p className="text-sm text-slate-600">{labels.loadingLugs}</p>
                ) : masterLugs.length === 0 ? (
                  <p className="text-sm text-slate-500">{labels.noLugsLoaded}</p>
                ) : (
                  <>
                    {currentUserLug ? (
                      <div className="mb-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.yourLug}</p>
                        <div
                          onDoubleClick={() => void openLugInfoPanel(currentUserLug.lug_id)}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-300 p-2"
                          style={{
                            backgroundColor: currentUserLug.color1 || "#eaf6ff",
                            color: getContrastTextColor(currentUserLug.color1 || "#eaf6ff"),
                          }}
                        >
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                            {currentUserLug.logo_data_url ? (
                              <Image
                                src={currentUserLug.logo_data_url}
                                alt={currentUserLug.nombre}
                                width={44}
                                height={44}
                                unoptimized
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{currentUserLug.nombre}</p>
                            <p className="truncate text-xs opacity-90">{`${currentUserLug.pais ?? labels.noCountry} - ${currentUserLug.members_count} ${labels.membersSuffix}`}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="max-h-[320px] overflow-auto rounded-md border border-slate-200 p-2">
                      {otherLugs.length === 0 ? (
                        <p className="text-sm text-slate-500">{labels.noOtherLugs}</p>
                      ) : (
                        <ul className="space-y-2">
                          {otherLugs.map((lug) => {
                            const canDirectJoin = canDirectJoinLug(lug);
                            return (
                              <li
                                key={lug.lug_id}
                                onDoubleClick={() => void openLugInfoPanel(lug.lug_id)}
                                className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 p-2"
                              >
                                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                                  {lug.logo_data_url ? (
                                    <Image
                                      src={lug.logo_data_url}
                                      alt={lug.nombre}
                                      width={44}
                                      height={44}
                                      unoptimized
                                      className="h-full w-full object-cover"
                                    />
                                  ) : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-slate-900">{lug.nombre}</p>
                                  <p className="truncate text-xs text-slate-600">{`${lug.pais ?? labels.noCountry} - ${lug.members_count} ${labels.membersSuffix}`}</p>
                                </div>
                                <button
                                  type="button"
                                  disabled={requestActionLoadingLugId === lug.lug_id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (canDirectJoin) {
                                      startLugAccessAction(lug);
                                    } else if (requestedLugIds.includes(lug.lug_id)) {
                                      void cancelLugJoinRequest(lug.lug_id, lug.nombre);
                                    } else {
                                      startLugAccessAction(lug);
                                    }
                                  }}
                                  className="ml-auto rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                                >
                                  {requestActionLoadingLugId === lug.lug_id
                                    ? t.processing
                                    : canDirectJoin
                                      ? labels.enterDirect
                                      : requestedLugIds.includes(lug.lug_id)
                                        ? labels.cancelRequest
                                        : labels.requestJoin}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setLugNombre("");
                          setLugPais("");
                          setLugDescripcion("");
                          setLugColor1("#006eb2");
                          setLugColor2("#ffffff");
                          setLugColor3("#111111");
                          setLugLogoDataUrl(null);
                          setLugLogoFile(null);
                          setLugLogoError("");
                          setCreateLugFromListFlow(true);
                          setShowCreateLugConfirmPanel(false);
                          setShowCreateLugPanel(true);
                        }}
                        className="rounded-md border px-4 py-2 text-sm font-semibold"
                        style={{
                          backgroundColor: uiColor1,
                          color: uiColor1Text,
                          borderColor: uiColor3,
                        }}
                      >
                        {labels.createNewLug}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {showJoinRequestFormPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowJoinRequestFormPanel(false)}>
            <div className="w-full max-w-[320px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <h3 className="text-base font-semibold text-slate-900">{labels.requestJoinTitle}</h3>
              <p className="mt-1 text-xs text-slate-600">{joinRequestTargetLugName}</p>

              <div className="mt-3 space-y-2">
                <textarea
                  value={joinRequestMessageInput}
                  onChange={(event) => setJoinRequestMessageInput(event.target.value)}
                  rows={3}
                  placeholder={labels.writeMessage}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={joinRequestSocialInput}
                  onChange={(event) => setJoinRequestSocialInput(event.target.value)}
                  placeholder={labels.socialNetwork}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void sendLugJoinRequest()}
                  disabled={joinRequestSending}
                  className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white"
                >
                  {joinRequestSending ? labels.sending : labels.send}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showLugInfoPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowLugInfoPanel(false)}>
            <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">{labels.lugInfoTitle}</h3>
              </div>

              {lugInfoLoading ? (
                <p className="mt-4 text-sm text-slate-600">{labels.loadingInfo}</p>
              ) : lugInfoData ? (
                <>
                  <div
                    className="mt-4 rounded-lg border border-slate-300 p-4"
                    style={{ backgroundColor: lugInfoData.color1 || "#eaf6ff" }}
                  >
                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                      <div className="mx-auto h-40 w-40 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {lugInfoData.logo_data_url ? (
                          <Image
                            src={lugInfoData.logo_data_url}
                            alt={lugInfoData.nombre}
                            width={160}
                            height={160}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="mt-4 text-center">
                        <p className="text-xl font-semibold text-slate-900">{lugInfoData.nombre || labels.noName}</p>
                        <p className="mt-1 text-sm text-slate-600">{lugInfoData.pais || labels.noCountry}</p>
                        <p className="mx-auto mt-4 max-w-[320px] text-sm leading-6 text-slate-700">{lugInfoData.descripcion || labels.noDescription}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-200 p-3">
                    <h4 className="text-sm font-semibold text-slate-900">{labels.members}</h4>
                    <div className="mt-2 max-h-[180px] overflow-auto rounded-md border border-slate-200 p-2">
                      {lugInfoData.members.length === 0 ? (
                        <p className="text-sm text-slate-500">{labels.noMembersLoaded}</p>
                      ) : (
                        <ul className="space-y-2">
                          {lugInfoData.members.map((member) => (
                            <li key={member.id} className="rounded-md border border-slate-200 px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-start gap-3">
                                  <div className="h-12 w-12 shrink-0 border border-slate-200 bg-slate-50 p-1">
                                    <Image
                                      src={getFaceImagePath(getAvatarFaceForMember(member.id, member.avatar_key))}
                                      alt={member.full_name}
                                      width={40}
                                      height={40}
                                      unoptimized
                                      className="h-full w-full object-contain"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <p className="truncate text-sm font-semibold text-slate-900">{member.full_name}</p>
                                      {member.rol_lug === "admin" ? (
                                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                          Admin
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 truncate text-xs text-slate-600">
                                      {member.social_platform && member.social_handle
                                        ? `${member.social_platform}: ${member.social_handle}`
                                        : labels.noSocial}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void openMiLugMemberChat(member.id, member.full_name)}
                                    disabled={memberChatLoadingId === member.id || member.id === userId}
                                    className="rounded-md border border-slate-300 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-60"
                                    title="Abrir chat"
                                  >
                                    <Image
                                      src="/api/avatar/Mensaje_A.svg"
                                      alt="Mensaje"
                                      width={22}
                                      height={22}
                                      unoptimized
                                      className="h-[22px] w-[22px] object-contain"
                                    />
                                  </button>
                                  {rolLug === "admin" && currentLugId === lugInfoData.lug_id && member.rol_lug !== "admin" ? (
                                    <button
                                      type="button"
                                      onClick={() => void promoteMemberToAdmin(member.id, member.full_name)}
                                      disabled={promoteMemberLoadingId === member.id}
                                      className="rounded-md border px-2 py-1 text-[11px] font-semibold"
                                      style={{
                                        backgroundColor: currentLugColor2 || "#ffffff",
                                        color: getContrastTextColor(currentLugColor2 || "#ffffff"),
                                        borderColor: currentLugColor3 || "#111111",
                                      }}
                                    >
                                      {promoteMemberLoadingId === member.id ? t.processing : labels.makeAdmin}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-600">{labels.noLugDetail}</p>
              )}
            </div>
          </div>
        ) : null}

        {showAdminRequestsPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowAdminRequestsPanel(false)}>
            <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">{labels.joinRequestsTitle}</h3>
                <button
                  type="button"
                  onClick={() => setShowAdminRequestsPanel(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  {labels.close}
                </button>
              </div>

              <div className="mt-3 max-h-[320px] overflow-auto rounded-md border border-slate-200 p-2">
                {adminRequestsLoading ? (
                  <p className="text-sm text-slate-600">{labels.loadingJoinRequests}</p>
                ) : adminRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">{labels.noPendingRequests}</p>
                ) : (
                  <ul className="space-y-2">
                    {adminRequests.map((request) => (
                      <li
                        key={request.request_id}
                        onClick={() => openAdminRequestDetail(request)}
                        className="cursor-pointer rounded-md border border-slate-200 p-3"
                      >
                        <p className="text-sm font-semibold text-slate-900">{request.full_name}</p>
                        <p className="text-xs text-slate-600">
                          {request.contact_social
                            ? request.contact_social
                            : request.social_platform && request.social_handle
                              ? `${request.social_platform}: ${request.social_handle}`
                              : labels.noSocial}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {showMasterEmptyLugsPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowMasterEmptyLugsPanel(false)}>
            <div className="w-full max-w-[460px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">{labels.emptyLugsTitle}</h3>
                <button
                  type="button"
                  onClick={() => setShowMasterEmptyLugsPanel(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  {labels.close}
                </button>
              </div>

              <div className="mt-3 max-h-[360px] overflow-auto rounded-md border border-slate-200 p-2">
                {masterEmptyLugsLoading ? (
                  <p className="text-sm text-slate-600">{labels.loadingEmptyLugs}</p>
                ) : masterEmptyLugs.length === 0 ? (
                  <p className="text-sm text-slate-500">{labels.noPendingEmptyLugs}</p>
                ) : (
                  <ul className="space-y-2">
                    {masterEmptyLugs.map((emptyLug) => (
                      <li key={emptyLug.notification_id} className="rounded-md border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">{emptyLug.nombre || labels.noName}</p>
                        <p className="text-xs text-slate-600">{emptyLug.pais || labels.noCountry}</p>
                        <p className="mt-1 text-xs text-slate-600">{emptyLug.descripcion || labels.noDescription}</p>

                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void resolveMasterEmptyLug(emptyLug.notification_id, "delete")}
                            disabled={masterLugActionLoadingId === emptyLug.notification_id}
                            className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700"
                          >
                            {labels.deleteLug}
                          </button>
                          <button
                            type="button"
                            onClick={() => void resolveMasterEmptyLug(emptyLug.notification_id, "open")}
                            disabled={masterLugActionLoadingId === emptyLug.notification_id}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {labels.leaveOpen}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {showAdminRequestDetailPanel && selectedAdminRequest ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setShowAdminRequestDetailPanel(false)}>
            <div className="w-full max-w-[360px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <h3 className="text-base font-semibold text-slate-900">{labels.requestJoinTitle}</h3>
              <p className="mt-2 text-sm font-semibold text-slate-900">{selectedAdminRequest.full_name}</p>
              <p className="mt-1 text-xs text-slate-600">
                {selectedAdminRequest.contact_social
                  ? selectedAdminRequest.contact_social
                  : selectedAdminRequest.social_platform && selectedAdminRequest.social_handle
                    ? `${selectedAdminRequest.social_platform}: ${selectedAdminRequest.social_handle}`
                    : labels.noSocial}
              </p>
              <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {selectedAdminRequest.request_message || labels.noMessage}
              </p>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void resolveAdminRequest("rejected")}
                  disabled={adminDecisionLoading}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {labels.reject}
                </button>
                <button
                  type="button"
                  onClick={() => void resolveAdminRequest("accepted")}
                  disabled={adminDecisionLoading}
                  className="rounded-md bg-[#006eb2] px-3 py-2 text-sm font-semibold text-white"
                >
                  {labels.accept}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showCreateLugPanel ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
            onClick={() => {
              setShowCreateLugPanel(false);
              setShowCreateLugConfirmPanel(false);
              setCreateLugFromListFlow(false);
            }}
          >
            <div className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <h3 className="font-boogaloo text-xl text-slate-900">{labels.createLug}</h3>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm text-slate-700">{labels.uploadLogoMax}</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void handleMasterLogoFileChange(file);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  {lugLogoDataUrl ? (
                    <Image src={lugLogoDataUrl} alt="Logo" width={80} height={80} unoptimized className="mt-2 h-20 w-20 rounded-md border border-slate-200 object-cover" />
                  ) : null}
                  {lugLogoError ? <p className="mt-1 text-xs text-red-600">{lugLogoError}</p> : null}
                </div>

                <div>
                  <label className="block text-sm text-slate-700">{labels.name}</label>
                  <input
                    type="text"
                    value={lugNombre}
                    onChange={(event) => setLugNombre(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700">{labels.countryCity}</label>
                  <input
                    type="text"
                    value={lugPais}
                    onChange={(event) => setLugPais(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700">{labels.description}</label>
                  <textarea
                    value={lugDescripcion}
                    onChange={(event) => setLugDescripcion(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm text-slate-700">{labels.color1}</label>
                    <input
                      type="text"
                      value={lugColor1}
                      onChange={(event) => setLugColor1(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700">{labels.color2}</label>
                    <input
                      type="text"
                      value={lugColor2}
                      onChange={(event) => setLugColor2(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700">{labels.color3}</label>
                    <input
                      type="text"
                      value={lugColor3}
                      onChange={(event) => setLugColor3(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateLugPanel(false);
                    setShowCreateLugConfirmPanel(false);
                    setCreateLugFromListFlow(false);
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                >
                  {labels.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (createLugFromListFlow) {
                      setShowCreateLugConfirmPanel(true);
                    } else {
                      void createLugFromMaster(false);
                    }
                  }}
                  disabled={creatingLug}
                  className="rounded-md border px-4 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: uiColor1,
                    color: uiColor1Text,
                    borderColor: uiColor3,
                  }}
                >
                  {creatingLug ? labels.creating : createLugFromListFlow ? labels.createNewLugShort : labels.createLugButton}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showCreateLugConfirmPanel ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setShowCreateLugConfirmPanel(false)}>
            <div className="w-full max-w-[360px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex justify-center">
                <Image
                  src="/api/avatar/LEGO-ICON_A.svg"
                  alt="LEGO icon"
                  width={192}
                  height={192}
                  unoptimized
                  className="h-48 w-48 object-contain"
                />
              </div>
              <p className="text-sm text-slate-900">{labels.leaveCurrentLugOnCreate}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateLugConfirmPanel(false)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {labels.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => void createLugFromMaster(true)}
                  disabled={creatingLug}
                  className="rounded-md border px-3 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: uiColor1,
                    color: uiColor1Text,
                    borderColor: uiColor3,
                  }}
                >
                  {labels.ok}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showLugAccessConfirmPanel ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
            onClick={() => {
              setShowLugAccessConfirmPanel(false);
              setPendingLugAccessAction(null);
            }}
          >
            <div className="w-full max-w-[360px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex justify-center">
                <Image
                  src="/api/avatar/LEGO-ICON_A.svg"
                  alt="LEGO icon"
                  width={192}
                  height={192}
                  unoptimized
                  className="h-48 w-48 object-contain"
                />
              </div>
              <p className="text-sm text-slate-900">{labels.leaveCurrentLugOnAccess}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLugAccessConfirmPanel(false);
                    setPendingLugAccessAction(null);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {labels.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => confirmLugAccessAction()}
                  className="rounded-md border px-3 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: uiColor1,
                    color: uiColor1Text,
                    borderColor: uiColor3,
                  }}
                >
                  {labels.ok}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showLanguagePickerPopup ? (
          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowLanguagePickerPopup(false)}>
            <div className="w-full max-w-[300px] rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-boogaloo text-xl text-slate-900">{t.language}</p>
                <button
                  type="button"
                  onClick={() => setShowLanguagePickerPopup(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700"
                >
                  {labels.close}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {uiLanguages.map((option) => (
                  <button
                    key={`lang-${option}`}
                    type="button"
                    onClick={() => void changeUiLanguage(option)}
                    disabled={languageChanging}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                      language === option ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                    }`}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mx-auto mt-2 w-full max-w-[800px] px-2 text-center">
          <p className="mx-auto inline-block px-2 text-xs font-semibold tracking-wide" style={{ color: "#a8a8a8" }}>
            {footerLegend || "LUGs App"}
          </p>
        </div>

        {status ? <p className="mx-auto mt-4 w-full max-w-[800px] rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">{status}</p> : null}

        {showLoaderPopup ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/20 p-4">
            <div className="w-[140px] rounded-xl border p-2 shadow-xl" style={{ backgroundColor: uiColor1, borderColor: uiColor3 }}>
              <div className="rounded-lg bg-white p-1">
                <Lottie animationData={loaderAnimationData} loop autoplay className="h-20 w-full" />
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="bg-lego-tile min-h-screen px-6 py-16">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-black/10 bg-white p-7 text-black shadow-sm">
        <div className="flex items-center justify-between gap-3 text-black">
          <h1 className="text-2xl font-semibold text-black">{t.appAccessTitle}</h1>
          <label className="flex items-center gap-2 text-sm text-black">
            <span>{t.language}</span>
            <select
              value={language}
              onChange={(event) => {
                const next = event.target.value as UiLanguage;
                setLanguage(next);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("ui_language", next);
                }
              }}
              className="rounded-md border border-black/20 px-2 py-1 text-black"
            >
              {uiLanguages.map((option) => (
                <option key={option} value={option}>
                  {uiLanguageLabels[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!supabase ? <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.missingEnv}</p> : null}

        <div className="mt-6 flex gap-2 rounded-lg bg-black/5 p-1">
          <button
            className={`w-1/2 rounded-md px-3 py-2 text-sm ${mode === "register" ? "bg-white shadow text-black" : "text-black"}`}
            onClick={() => setMode("register")}
            type="button"
          >
            {t.register}
          </button>
          <button
            className={`w-1/2 rounded-md px-3 py-2 text-sm ${mode === "login" ? "bg-white shadow text-black" : "text-black"}`}
            onClick={() => setMode("login")}
            type="button"
          >
            {t.login}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Tip: usa {t.login} si ya tenes cuenta. {t.register} puede enviar emails y activar limites temporales.
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-black" htmlFor="email">
              {t.email}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black" htmlFor="password">
              {t.password}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm outline-none focus:border-black"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !supabase || authCooldownRemaining > 0}
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? t.processing : authCooldownRemaining > 0 ? `Espera ${authCooldownRemaining}s` : submitText}
          </button>
          <button
            type="button"
            onClick={() => void handleResendConfirmationEmail()}
            disabled={loading || !supabase || authCooldownRemaining > 0}
            className="w-full rounded-lg border border-black/20 bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-60"
          >
            {t.resendConfirmation}
          </button>
        </form>

        {status ? <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">{status}</p> : null}

        <div className="mt-2 w-full px-2 text-center">
          <p className="mx-auto inline-block px-2 text-xs font-semibold tracking-wide" style={{ color: "#a8a8a8" }}>
            {footerLegend || "LUGs App"}
          </p>
        </div>

        {showLoaderPopup ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/20 p-4">
            <div className="w-[140px] rounded-xl border p-2 shadow-xl" style={{ backgroundColor: uiColor1, borderColor: uiColor3 }}>
              <div className="rounded-lg bg-white p-1">
                <Lottie animationData={loaderAnimationData} loop autoplay className="h-20 w-full" />
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
