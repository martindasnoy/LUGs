"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
  social_platform: string | null;
  social_handle: string | null;
  rol_lug: string | null;
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

type AppSection = "dashboard" | "listas" | "lista_detalle";
type ListaTipo = "deseos" | "venta";
type ListaVisibilidad = "privado" | "publico";

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

type ListPartItem = {
  item_id: string;
  part_num: string | null;
  part_name: string | null;
  color_name: string | null;
  quantity: number;
};

type CategoriesPanelMode = "categories" | "parts";
type CategoryQuickFilter = "all" | "popular" | "minifig" | "technic" | "otros";

type RolLug = "admin" | "common" | null;

const FACE_TOTAL = 20;
const DEFAULT_LOADING_PHRASES = [
  "Clasificando piezas",
  "Desarmando sets",
  "Creando MOCs",
  "Armando minifiguras",
  "Pegando stickers en un quesito",
];

export default function Home() {
  const supabase = getSupabaseClient();
  const [mode, setMode] = useState<Mode>("login");
  const [language, setLanguage] = useState<UiLanguage>(() => {
    if (typeof window === "undefined") {
      return "es";
    }

    const stored = window.localStorage.getItem("ui_language");
    return stored === "en" ? "en" : "es";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
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
  const [showMaintenancePanel, setShowMaintenancePanel] = useState(false);
  const [maintenanceDraftMessageLine1, setMaintenanceDraftMessageLine1] = useState("");
  const [maintenanceDraftMessageLine2, setMaintenanceDraftMessageLine2] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentLugId, setCurrentLugId] = useState<string | null>(null);
  const [rolLug, setRolLug] = useState<RolLug>(null);
  const [displayName, setDisplayName] = useState("Usuario");
  const [isMaster, setIsMaster] = useState(false);

  const [showUserSettings, setShowUserSettings] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNameInput, setSettingsNameInput] = useState("");
  const [settingsEmailInput, setSettingsEmailInput] = useState("");
  const [settingsLanguageInput, setSettingsLanguageInput] = useState<UiLanguage>("es");
  const [settingsLugName, setSettingsLugName] = useState("Sin LUG");
  const [settingsLugId, setSettingsLugId] = useState<string | null>(null);
  const [settingsSocialPlatform, setSettingsSocialPlatform] = useState<SocialPlatform>("instagram");
  const [settingsSocialHandle, setSettingsSocialHandle] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [settingsPasswordInput, setSettingsPasswordInput] = useState("");
  const [settingsPasswordConfirmInput, setSettingsPasswordConfirmInput] = useState("");
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
    if (typeof window === "undefined") {
      return "dashboard";
    }

    const stored = window.localStorage.getItem("active_section_v1");
    if (stored === "listas" || stored === "lista_detalle") {
      return stored;
    }
    return "dashboard";
  });
  const [showCreateListaPanel, setShowCreateListaPanel] = useState(false);
  const [newListaTipo, setNewListaTipo] = useState<ListaTipo>("deseos");
  const [newListaNombre, setNewListaNombre] = useState("");
  const [listasItems, setListasItems] = useState<ListaItem[]>([]);
  const [listasLoading, setListasLoading] = useState(false);
  const [listasSaving, setListasSaving] = useState(false);
  const [showDeleteListaConfirmPanel, setShowDeleteListaConfirmPanel] = useState(false);
  const [listaToDelete, setListaToDelete] = useState<ListaItem | null>(null);
  const [selectedListForItems, setSelectedListForItems] = useState<ListaItem | null>(null);
  const [listItemsLoading, setListItemsLoading] = useState(false);
  const [listItemsRows, setListItemsRows] = useState<ListPartItem[]>([]);
  const [partsCategories, setPartsCategories] = useState<PartCategoryItem[]>([]);
  const [partsSearchLoading, setPartsSearchLoading] = useState(false);
  const [partsSearchQuery, setPartsSearchQuery] = useState("");
  const [partsSearchCategoryId, setPartsSearchCategoryId] = useState<number | null>(null);
  const [partsSearchResults, setPartsSearchResults] = useState<PartCatalogItem[]>([]);
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
  const [addItemColorNameInput, setAddItemColorNameInput] = useState("");
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [selectedSearchPartNum, setSelectedSearchPartNum] = useState<string | null>(null);
  const [itemQuantityInputs, setItemQuantityInputs] = useState<Record<string, string>>({});

  const t = useMemo(() => uiTranslations[language], [language]);
  const submitText = mode === "register" ? t.createAccount : t.signIn;
  const currentUserLug = useMemo(
    () => masterLugs.find((lug) => lug.lug_id === currentLugId) ?? null,
    [masterLugs, currentLugId],
  );
  const otherLugs = useMemo(
    () => masterLugs.filter((lug) => lug.lug_id !== currentLugId),
    [masterLugs, currentLugId],
  );
  const listasDeseos = useMemo(() => listasItems.filter((item) => item.tipo === "deseos"), [listasItems]);
  const listasVenta = useMemo(() => listasItems.filter((item) => item.tipo === "venta"), [listasItems]);
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
    partsSearchLoading;

  function getFaceImagePath(faceNum: number) {
    return `/api/avatar/Cabeza_${String(faceNum).padStart(2, "0")}.png`;
  }

  function parseAvatarFace(avatarKey: string | null | undefined) {
    const raw = String(avatarKey ?? "");
    const maybe = Number(raw.replace("Cabeza_", "").replace(".png", ""));
    return Number.isFinite(maybe) && maybe >= 1 && maybe <= FACE_TOTAL ? maybe : 1;
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

    setStatus("Frases de carga guardadas.");
    setShowLoadingPhrasesPanel(false);
  }

  const loadMaintenanceSettings = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("app_maintenance")
      .select("enabled, message_line1, message_line2")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setMaintenanceEnabled(Boolean(data?.enabled));
    setMaintenanceMessageLine1(String(data?.message_line1 ?? "Estamos en mantenimiento"));
    setMaintenanceMessageLine2(String(data?.message_line2 ?? "Volvé en un rato"));
  }, [supabase, t.errorPrefix]);

  function openMaintenancePanel() {
    setMaintenanceDraftMessageLine1(maintenanceMessageLine1 || "");
    setMaintenanceDraftMessageLine2(maintenanceMessageLine2 || "");
    setShowMaintenancePanel(true);
  }

  async function activateMaintenanceMode() {
    if (!supabase) {
      return;
    }

    const nextLine1 = maintenanceDraftMessageLine1.trim() || "Estamos en mantenimiento";
    const nextLine2 = maintenanceDraftMessageLine2.trim() || "Volvé en un rato";

    const { error } = await supabase
      .from("app_maintenance")
      .update({
        enabled: true,
        message_line1: nextLine1,
        message_line2: nextLine2,
      })
      .eq("id", 1);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setMaintenanceEnabled(true);
    setMaintenanceMessageLine1(nextLine1);
    setMaintenanceMessageLine2(nextLine2);
    setShowMaintenancePanel(false);
    setStatus("Mantenimiento activado.");
  }

  async function disableMaintenanceMode() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from("app_maintenance")
      .update({
        enabled: false,
        message_line1: maintenanceMessageLine1,
        message_line2: maintenanceMessageLine2,
      })
      .eq("id", 1);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      return;
    }

    setMaintenanceEnabled(false);
    setStatus("Mantenimiento desactivado.");
  }

  const loadListasFromDb = useCallback(async () => {
    if (!supabase || !userId) {
      setListasItems([]);
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
    setListasLoading(false);
  }, [supabase, t.errorPrefix, userId]);

  async function createListaItem() {
    if (!supabase || !userId) {
      return;
    }

    const nombre = newListaNombre.trim();
    if (!nombre) {
      setStatus("El nombre de la lista es obligatorio.");
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
    setListaToDelete(item);
    setShowDeleteListaConfirmPanel(true);
  }

  async function deleteListaConfirmed() {
    if (!supabase || !userId || !listaToDelete) {
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
  }, [supabase, t.errorPrefix]);

  const openListasSection = useCallback(async () => {
    setActiveSection("listas");
    await Promise.all([loadListasFromDb(), loadPartsCategories()]);
  }, [loadListasFromDb, loadPartsCategories]);

  const loadListItems = useCallback(
    async (listId: string) => {
      if (!supabase || !userId) {
        return;
      }

      setListItemsLoading(true);

      const { data, error } = await supabase
        .from("list_items")
        .select("item_id, part_num, part_name, color_name, quantity")
        .eq("list_id", listId)
        .order("created_at", { ascending: false });

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
        quantity: Number(row.quantity ?? 1),
      }));

      setListItemsRows(parsedRows);
      setItemQuantityInputs(
        parsedRows.reduce(
          (acc: Record<string, string>, item) => {
            acc[item.item_id] = String(Math.max(1, Number(item.quantity) || 1));
            return acc;
          },
          {},
        ),
      );
      setListItemsLoading(false);
    },
    [supabase, t.errorPrefix, userId],
  );

  async function openListDetailPage(lista: ListaItem) {
    setSelectedListForItems(lista);
    setActiveSection("lista_detalle");
    setPartsSearchQuery("");
    setPartsSearchCategoryId(null);
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
    setAddItemColorNameInput("");
    setAddItemColorMode("bricklink");
    setAddItemQuantity(1);
    if (partsCategories.length === 0) {
      await loadPartsCategories();
    }
    await loadListItems(lista.id);
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
      setStatus("El nombre de la lista es obligatorio.");
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

  async function searchPartsCatalog() {
    if (!supabase) {
      return;
    }

    setPartsSearchLoading(true);

    const { data, error } = await supabase.rpc("search_parts_catalog", {
      p_query: partsSearchQuery.trim() || null,
      p_category_id: partsSearchCategoryId,
      p_limit: 30,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setPartsSearchLoading(false);
      return;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    setPartsSearchResults(
      rows.map((row) => ({
        part_num: String(row.part_num ?? ""),
        name: String(row.name ?? ""),
        part_img_url: row.part_img_url ? String(row.part_img_url) : null,
        category_id: row.category_id ? Number(row.category_id) : null,
      })),
    );

    const firstPartNum = rows[0]?.part_num ? String(rows[0].part_num) : null;
    setSelectedSearchPartNum(firstPartNum);

    setPartsSearchLoading(false);
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
      });

      if (queryText) {
        params.set("q", queryText);
      }

      const response = await fetch(`/api/rebrickable/parts?${params.toString()}`);
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
    },
  ) {
    if (!supabase || !selectedListForItems || !userId) {
      return;
    }

    const quantity = Math.max(1, Number(options?.quantity ?? 1));
    const cleanColor = String(options?.colorName ?? "").trim();
    const colorMode = options?.colorMode ?? "bricklink";
    const colorName = cleanColor ? `${colorMode === "lego" ? "LEGO" : "BrickLink"}: ${cleanColor}` : null;

    setListasSaving(true);

    const { error } = await supabase.from("list_items").insert({
      list_id: selectedListForItems.id,
      part_num: part.part_num,
      part_name: part.name,
      color_name: colorName,
      quantity,
    });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setListasSaving(false);
      return;
    }

    await loadListItems(selectedListForItems.id);
    await loadListasFromDb();
    setSelectedSearchPartNum(part.part_num);
    setStatus(`Item agregado: ${part.part_num}`);
    setListasSaving(false);
  }

  async function addSelectedPartToList() {
    if (!selectedSearchPart) {
      setStatus("Seleccioná una pieza primero.");
      return;
    }

    if (!addItemColorNameInput.trim()) {
      setStatus("Completá el color antes de agregar el item.");
      return;
    }

    await addPartToList(selectedSearchPart, {
      colorName: addItemColorNameInput,
      quantity: addItemQuantity,
      colorMode: addItemColorMode,
    });

    setPartsSearchQuery("");
    setPartsSearchResults([]);
    setSelectedSearchPartNum(null);
    setAddItemColorNameInput("");
    setAddItemQuantity(1);
  }

  function selectPartForAddItem(part: PartCatalogItem) {
    setPartsSearchResults([part]);
    setSelectedSearchPartNum(part.part_num);
    setPartsSearchQuery(`${part.part_num} - ${part.name}`);
    setShowCategoriesPanel(false);
    setCategoriesPanelMode("categories");
    setSelectedPanelCategory(null);
  }

  async function deleteListItem(itemId: string) {
    if (!supabase || !selectedListForItems) {
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
    setStatus("Item eliminado.");
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
      setStatus(`${t.errorPrefix}: ${error.message}`);
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
      setStatus(`${t.errorPrefix}: ${error.message}`);
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
      setStatus(`${t.errorPrefix}: ${error.message}`);
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

    setDisplayName(fullName || fallbackName);
    setSelectedFace(face);
    setPreviewFace(face);

    if (lang === "es" || lang === "en") {
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
        if (activeSection === "listas") {
          await openListasSection();
        }
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
          if (activeSection === "listas") {
            await openListasSection();
          }
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
  }, [activeSection, loadMaintenanceSettings, loadUserState, openListasSection, startBootLoading, supabase]);

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

    const intervalId = window.setInterval(() => {
      void loadMasterEmptyNotificationsCount();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [isMaster, loadMasterEmptyNotificationsCount, userId]);

  useEffect(() => {
    if (!showMasterEmptyLugsPanel) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadMasterEmptyNotificationsList();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [loadMasterEmptyNotificationsList, showMasterEmptyLugsPanel]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    if (!supabase) {
      setStatus(t.missingEnv);
      setLoading(false);
      return;
    }

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({ email, password });
      setStatus(error ? `${t.errorPrefix}: ${error.message}` : t.accountCreated);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setStatus(error ? `${t.errorPrefix}: ${error.message}` : "");
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

  async function openUserSettings() {
    if (!supabase || !userId) {
      return;
    }

    await ensureProfile(userId, userEmail);

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, social_platform, social_handle, avatar_key, preferred_language, current_lug_id, rol_lug")
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
    setSettingsLanguageInput(String(data?.preferred_language ?? language) === "en" ? "en" : "es");
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

      setSettingsLugName(String(lugData?.nombre ?? "Sin LUG"));
    } else {
      setSettingsLugName("Sin LUG");
    }

    setShowPasswordFields(false);
    setSettingsPasswordInput("");
    setSettingsPasswordConfirmInput("");
    setShowFacePicker(false);
    setShowUserSettings(true);
  }

  async function saveUserSettings() {
    if (!supabase || !userId) {
      return;
    }

    setSettingsSaving(true);

    if (showPasswordFields) {
      if (settingsPasswordInput.length < 6) {
        setStatus("La nueva contrasena debe tener al menos 6 caracteres.");
        setSettingsSaving(false);
        return;
      }

      if (settingsPasswordInput !== settingsPasswordConfirmInput) {
        setStatus("Las contrasenas no coinciden.");
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
    setStatus("Configuracion guardada.");
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
      setStatus("El nombre del LUG es obligatorio.");
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
    setStatus("LUG asignado al usuario.");
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

    setCurrentLugId(lugId);
    setSettingsLugId(lugId);
    setRolLug("common");
    await loadCurrentLugPalette(lugId);
    await loadMyJoinRequests(userId);
    await loadMasterLugs();
    setRequestActionLoadingLugId(null);
    setStatus(`Ingresaste directo a ${lugName}.`);
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
    const nextType: PendingLugAccessAction["type"] = lug.open_access ? "direct" : "request";

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
    const members = membersRows.map((member) => ({
      id: String(member.id),
      full_name: String(member.full_name ?? "Usuario"),
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
      setStatus("Este usuario no tiene LUG asignado.");
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
      setStatus("Solo un admin del LUG puede editar esta informacion.");
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
    setStatus("Informacion del LUG actualizada.");
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
      setStatus("No pudimos calcular la cantidad de miembros por LUG.");
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
  }, [supabase, t.errorPrefix]);

  if (maintenanceEnabled && !isMaster) {
    return (
      <main className="bg-lego-tile min-h-screen">
        <div className="flex min-h-screen items-center justify-center px-4">
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

  if (userEmail) {
    if (activeSection === "lista_detalle" && selectedListForItems) {
      const listTypeLabel = selectedListForItems.tipo === "deseos" ? "deseos" : "venta";
      const visibilityLabel = selectedListForItems.visibilidad === "publico" ? "Publica" : "Privada";
      const totalLotes = listItemsRows.length;
      const totalPiezas = listItemsRows.reduce((acc, row) => acc + Math.max(0, Number(row.quantity) || 0), 0);

      return (
        <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-[900px] rounded-2xl border-[10px] p-[1px] shadow-xl" style={{ borderColor: uiColor1 }}>
            <div className="rounded-xl border-[5px] bg-white p-4 sm:p-8" style={{ borderColor: currentLugColor2 || "#ffffff", backgroundColor: "#ffffff" }}>
              <header>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-boogaloo text-3xl font-semibold text-slate-900">{`Lista de ${listTypeLabel} ${selectedListForItems.nombre}`}</h2>
                  <button
                    type="button"
                    onClick={() => setActiveSection("listas")}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    Volver
                  </button>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">{visibilityLabel}</p>
                <p className="mt-1 text-sm text-slate-600">{`Cantidad de lotes: ${totalLotes} - Cantidad de piezas: ${totalPiezas}`}</p>
                <div className="mt-3 h-[5px] w-full rounded-full" style={{ backgroundColor: currentLugColor2 || "#ffffff" }} />
              </header>

              <section className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-3 sm:p-4">
                <p className="font-boogaloo text-base font-semibold text-slate-900">Agregar item</p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[170px_minmax(0,1fr)]">
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
                    Categorias
                  </button>
                  <input
                    type="text"
                    value={partsSearchQuery}
                    onChange={(event) => setPartsSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void searchPartsCatalog();
                      }
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Buscar por nombre o part_num"
                  />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_200px_auto]">
                  <input
                    type="text"
                    value={addItemColorNameInput}
                    onChange={(event) => setAddItemColorNameInput(event.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Color"
                  />

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

                  <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-300 bg-white">
                    <button
                      type="button"
                      onClick={() => setAddItemColorMode("bricklink")}
                      className={`px-3 py-2 text-xs font-semibold ${
                        addItemColorMode === "bricklink" ? "bg-slate-900 text-white" : "text-slate-700"
                      }`}
                    >
                      BrickLink
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddItemColorMode("lego")}
                      className={`border-l border-slate-300 px-3 py-2 text-xs font-semibold ${
                        addItemColorMode === "lego" ? "bg-slate-900 text-white" : "text-slate-700"
                      }`}
                    >
                      LEGO
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void addSelectedPartToList()}
                    disabled={!selectedSearchPart || !addItemColorNameInput.trim()}
                    className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    style={{ backgroundColor: uiColor1, color: uiColor1Text }}
                  >
                    Agregar item
                  </button>
                </div>

              </section>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setStatus("Exportar en preparación.")}
                  className="w-full rounded-md px-4 py-2 text-sm font-semibold"
                  style={{ backgroundColor: uiColor1, color: uiColor1Text }}
                >
                  Exportar
                </button>
              </div>

              <div className="mt-3">
                <div className="rounded-md border border-slate-200 p-2">
                  <p className="font-boogaloo text-xs font-semibold uppercase tracking-wide text-slate-500">Ítems de la lista</p>
                  <div className="mt-2 max-h-[340px] overflow-auto space-y-2">
                    {listItemsRows.length === 0 ? (
                      <p className="text-sm text-slate-500">Esta lista todavía no tiene piezas.</p>
                    ) : (
                      listItemsRows.map((row) => (
                        <div key={row.item_id} className="rounded-md border border-slate-200 px-2 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900">{row.part_num || "-"}</p>
                              <p className="text-xs text-slate-600">{row.part_name || "Sin nombre"}</p>
                              <p className="text-[11px] text-slate-500">{row.color_name || "Sin color"}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void deleteListItem(row.item_id)}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                              title="Eliminar lote"
                            >
                              🗑
                            </button>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[11px] text-slate-500">Cantidad</span>
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
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

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
                          title="Volver a categorías"
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
                          No impresas
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePanelPrintFilter("printed")}
                          className={`rounded-md border px-3 py-1 text-sm font-semibold ${
                            panelPrintFilters.printed ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                          }`}
                        >
                          Impresas
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
                        Cerrar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-boogaloo text-2xl text-slate-900">Catalogo</p>
                      <button
                        type="button"
                        onClick={() => setCategoryQuickFilter("all")}
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          categoryQuickFilter === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryQuickFilter("popular")}
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          categoryQuickFilter === "popular" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                        }`}
                      >
                        Popular
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
                        Otros
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
                      Cerrar
                    </button>
                  </div>
                )}

                {categoriesPanelMode === "parts" && selectedPanelCategory ? (
                  <>
                    <div className="mt-3 rounded-md border border-slate-300 p-2">
                      {panelPartsLoading ? (
                        <p className="px-2 py-3 text-sm text-slate-500">Cargando piezas...</p>
                      ) : panelFilteredParts.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-slate-500">Sin piezas para mostrar.</p>
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
                              title="Doble clic para agregar"
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
                      <p className="px-2 py-2 text-sm text-slate-500">No hay categorias para mostrar. Primero hay que sincronizar el catalogo.</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setPartsSearchCategoryId(cat.id);
                              setSelectedPanelCategory(cat);
                              setCategoriesPanelMode("parts");
                              setPanelPartsPage(1);
                              void loadPanelCategoryParts(cat, partsSearchQuery);
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

    if (activeSection === "listas") {
      return (
        <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-[800px] rounded-2xl border-[10px] p-[1px] shadow-xl" style={{ borderColor: uiColor1 }}>
            <div className="rounded-xl border-[5px] bg-white p-4 sm:p-8" style={{ borderColor: currentLugColor2 || "#ffffff", backgroundColor: "#ffffff" }}>
              <header>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-boogaloo text-3xl font-semibold text-slate-900">Listas</h2>
                  <button
                    type="button"
                    onClick={() => setActiveSection("dashboard")}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    Volver
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
                <p className="text-sm font-semibold text-slate-800">Crear lista</p>
              </div>

              <div className="mt-4 space-y-5">
                <section>
                  <h3 className="font-boogaloo text-sm font-semibold text-slate-700">Tus listas de deseos creadas</h3>
                  <div className="mt-2 space-y-2">
                    {listasDeseos.length === 0 ? (
                      <p className="text-sm text-slate-500">Sin listas de deseos.</p>
                    ) : (
                      listasDeseos.map((item) => (
                        <div
                          key={item.id}
                          onDoubleClick={() => void openListDetailPage(item)}
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
                                title="Renombrar lista"
                              >
                                ✎
                              </button>
                            </div>
                            <p className="text-xs text-slate-600">{`Lotes: ${item.lotes} - Piezas: ${item.piezas}`}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void setListaVisibilidad(item.id, "privado")}
                                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                  item.visibilidad === "privado" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                                }`}
                              >
                                Privado
                              </button>
                              <button
                                type="button"
                                onClick={() => void setListaVisibilidad(item.id, "publico")}
                                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                  item.visibilidad === "publico" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                                }`}
                              >
                                Público
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => openDeleteListaConfirm(item)}
                              className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700"
                            >
                              Chau lista
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="font-boogaloo text-sm font-semibold text-slate-700">Tus listas de venta creadas</h3>
                  <div className="mt-2 space-y-2">
                    {listasVenta.length === 0 ? (
                      <p className="text-sm text-slate-500">Sin listas de venta.</p>
                    ) : (
                      listasVenta.map((item) => (
                        <div
                          key={item.id}
                          onDoubleClick={() => void openListDetailPage(item)}
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
                                title="Renombrar lista"
                              >
                                ✎
                              </button>
                            </div>
                            <p className="text-xs text-slate-600">{`Lotes: ${item.lotes} - Piezas: ${item.piezas}`}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void setListaVisibilidad(item.id, "privado")}
                                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                  item.visibilidad === "privado" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                                }`}
                              >
                                Privado
                              </button>
                              <button
                                type="button"
                                onClick={() => void setListaVisibilidad(item.id, "publico")}
                                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                  item.visibilidad === "publico" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                                }`}
                              >
                                Público
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => openDeleteListaConfirm(item)}
                              className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700"
                            >
                              Chau lista
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>

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
                    Lista de deseos
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewListaTipo("venta")}
                    className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                      newListaTipo === "venta" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                    }`}
                  >
                    Lista de venta
                  </button>
                </div>

                <label className="block text-sm text-slate-700">Nombre</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={newListaNombre}
                    onChange={(event) => setNewListaNombre(event.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Nombre de la lista"
                  />
                  <button
                    type="button"
                    onClick={() => void createListaItem()}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Crear lista
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
                <h3 className="text-lg font-semibold text-slate-900">Renombrar lista</h3>
                <label className="mt-3 block text-sm text-slate-700">Nombre</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={renameListaInput}
                    onChange={(event) => setRenameListaInput(event.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Nombre de la lista"
                  />
                  <button
                    type="button"
                    onClick={() => void saveRenameLista()}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Guardar
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
                  ¿Estas seguro que queres borrar la lista? Se perdera la informacion de todas las piezas que esten dentro.
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
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteListaConfirmed()}
                    className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700"
                  >
                    Sí
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

    return (
      <main className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-[800px]">
          {isMaster ? (
            <button
              type="button"
              className="mb-3 w-full rounded-lg bg-black px-4 py-2 text-left text-sm font-semibold text-white"
              onClick={() => {
                setShowMasterPanel(true);
                void loadMasterLugs();
              }}
            >
              Master
            </button>
          ) : null}

          <div className="rounded-2xl border-[10px] p-[1px] shadow-xl" style={{ borderColor: uiColor1 }}>
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
                      aria-label={t.settingsAria}
                      title={t.settingsTitle}
                      onClick={() => void openUserSettings()}
                      className="rounded-md border border-black/20 p-2"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 1-2 0 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 1 0-2 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6c.38 0 .75-.14 1-.4a1.7 1.7 0 0 1 2 0c.25.26.62.4 1 .4a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c0 .38.14.75.4 1a1.7 1.7 0 0 1 0 2c-.26.25-.4.62-.4 1Z" />
                      </svg>
                    </button>
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
              {currentLugLogoDataUrl || currentUserLug?.logo_data_url ? (
                <Image
                  src={currentLugLogoDataUrl || currentUserLug?.logo_data_url || ""}
                  alt={currentUserLug?.nombre || "Logo LUG"}
                  width={88}
                  height={88}
                  unoptimized
                  className="h-[88px] w-[88px] object-contain"
                />
              ) : null}
            </div>

            <div className="mt-3 h-[5px] w-full rounded-full" style={{ backgroundColor: currentLugColor2 || "#ffffff" }} />

            <div className="mt-3 grid w-full grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  void openListasSection();
                }}
                className="flex aspect-[5/3] w-full items-center justify-center rounded-lg border-2 bg-white text-center text-xs font-semibold text-slate-700"
                style={{ borderColor: currentLugColor2 || "#ffffff" }}
              >
                Listas
              </button>
              <button
                type="button"
                onClick={() => setStatus("Minifiguras en preparación.")}
                className="flex aspect-[5/3] w-full items-center justify-center rounded-lg border-2 bg-white text-center text-xs font-semibold text-slate-700"
                style={{ borderColor: currentLugColor2 || "#ffffff" }}
              >
                Minifiguras
              </button>
              <button
                type="button"
                onClick={() => setStatus("Módulo X en preparación.")}
                className="flex aspect-[5/3] w-full items-center justify-center rounded-lg border-2 bg-white text-center text-xs font-semibold text-slate-700"
                style={{ borderColor: currentLugColor2 || "#ffffff" }}
              >
                X
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
                <Image
                  src="/api/avatar/Mundo.png"
                  alt="Ver LUGs"
                  width={200}
                  height={200}
                  unoptimized
                  className="h-[88%] w-[88%] object-contain"
                />
              </button>
            </div>
          </header>
          </div>
          </div>

        {showUserSettings ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
              <h3 className="font-boogaloo text-xl text-slate-900">Configuracion de usuario</h3>

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
                  <label className="block text-sm text-slate-700">Nombre</label>
                  <input
                    type="text"
                    value={settingsNameInput}
                    onChange={(event) => setSettingsNameInput(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <label className="mt-3 block text-sm text-slate-700">Mail</label>
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
                {showPasswordFields ? "Ocultar cambio de contrasena" : "Cambiar contrasena"}
              </button>

              {showPasswordFields ? (
                <>
                  <label className="mt-3 block text-sm text-slate-700">Nueva contrasena</label>
                  <input
                    type="password"
                    value={settingsPasswordInput}
                    onChange={(event) => setSettingsPasswordInput(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <label className="mt-3 block text-sm text-slate-700">Repetir contrasena</label>
                  <input
                    type="password"
                    value={settingsPasswordConfirmInput}
                    onChange={(event) => setSettingsPasswordConfirmInput(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </>
              ) : null}

              <label className="mt-3 block text-sm text-slate-700">LUG</label>
              <button
                type="button"
                onClick={() => void openSettingsLugPanel()}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-left"
              >
                {settingsLugName}
                {rolLug === "admin" ? " (admin)" : ""}
              </button>

              <label className="mt-3 block text-sm text-slate-700">Red social</label>
              <div className="mt-1 grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                <select
                  value={settingsSocialPlatform}
                  onChange={(event) => setSettingsSocialPlatform(event.target.value as SocialPlatform)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="">Ninguna</option>
                </select>
                <input
                  type="text"
                  value={settingsSocialHandle}
                  onChange={(event) => setSettingsSocialHandle(event.target.value)}
                  placeholder="usuario"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <label className="mt-3 block text-sm text-slate-700">Idioma</label>
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
                    <p className="text-sm text-slate-700">Doble clic para seleccionar</p>
                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                      {Array.from({ length: FACE_TOTAL }, (_, index) => {
                        const faceNum = index + 1;
                        const isPreview = previewFace === faceNum;
                        return (
                          <button
                            key={faceNum}
                            type="button"
                            onClick={() => setPreviewFace(faceNum)}
                            onDoubleClick={() => {
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
                  onClick={() => {
                    setShowFacePicker(false);
                    setShowPasswordFields(false);
                    setSettingsPasswordInput("");
                    setSettingsPasswordConfirmInput("");
                    setShowUserSettings(false);
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                >
                  Cancelar
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
                  {settingsSaving ? "Guardando..." : "Guardar"}
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
                  {rolLug === "admin" ? "Propiedades del LUG" : "Informacion del LUG"}
                </h3>
                {rolLug === "admin" ? (
                  <button
                    type="button"
                    onClick={() => setShowSettingsLugPanel(false)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                  >
                    Cerrar
                  </button>
                ) : null}
              </div>

              {settingsLugPanelLoading ? (
                <p className="mt-4 text-sm text-slate-600">Cargando informacion del LUG...</p>
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
                          <p className="text-xl font-semibold text-slate-900">{settingsLugNombreInput || "Sin LUG"}</p>
                          <p className="mt-1 text-sm text-slate-600">{settingsLugPaisInput || "Sin pais"}</p>
                          <p className="mx-auto mt-4 max-w-[420px] text-sm leading-6 text-slate-700">{settingsLugDescripcionInput || "Sin descripcion"}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto mt-4 w-full max-w-[500px] space-y-3">
                      <div>
                        <label className="block text-sm text-slate-700">Logo</label>
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
                        <label className="block text-sm text-slate-700">Nombre</label>
                        <input
                          type="text"
                          value={settingsLugNombreInput}
                          onChange={(event) => setSettingsLugNombreInput(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700">Pais / ciudad</label>
                        <input
                          type="text"
                          value={settingsLugPaisInput}
                          onChange={(event) => setSettingsLugPaisInput(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700">Descripcion</label>
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
                        Cambiar de LUG
                      </button>
                    ) : null}
                    {rolLug === "admin" ? (
                      <button
                        type="button"
                        onClick={() => setShowSettingsLugPanel(false)}
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                      >
                        Cerrar
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
                        {settingsLugSaving ? "Guardando..." : "Guardar"}
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
            <div className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900" style={{ fontFamily: "var(--font-chewy), cursive" }}>
                  Panel Master
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMasterPanel(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  Cerrar
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
                    Crear LUG
                  </button>
                </div>

                <div className="mt-3 max-h-[320px] overflow-auto rounded-md border border-slate-200 p-2">
                  <p className="mb-2 text-xs text-slate-500">Doble clic en un LUG para asignarlo como actual.</p>
                  {masterLugsLoading ? (
                    <p className="text-sm text-slate-600">Cargando LUGs...</p>
                  ) : masterLugs.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay LUGs cargados.</p>
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
                            <p className="truncate text-xs text-slate-600">{lug.pais ?? "Sin pais"}</p>
                          </div>
                          <p className="text-xs text-slate-700">{lug.members_count} miembros</p>
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

              <div className="mt-4 rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-900" style={{ fontFamily: "var(--font-chewy), cursive" }}>
                  Mantenimiento
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
                    Frases de carga
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
                    {maintenanceEnabled ? "Sacar de mantenimiento" : "Bloqueo de mantenimiento"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showLoadingPhrasesPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowLoadingPhrasesPanel(false)}>
            <div className="w-full max-w-[560px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <h3 className="text-xl text-slate-900">Frases de carga</h3>
              <p className="mt-1 text-sm text-slate-600">Edita y guarda las frases. Se aplica en próximas cargas.</p>

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
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => saveLoadingPhrases(loadingPhrasesDraft)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showMaintenancePanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowMaintenancePanel(false)}>
            <div className="w-full max-w-[620px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">Bloqueo de mantenimiento</h3>
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
                  Poner en mantenimiento
                </button>
              </div>

              <label className="block text-sm text-slate-700">Frase linea 1</label>
              <input
                type="text"
                value={maintenanceDraftMessageLine1}
                onChange={(event) => setMaintenanceDraftMessageLine1(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Escribí la primera línea"
              />

              <label className="mt-3 block text-sm text-slate-700">Frase linea 2</label>
              <input
                type="text"
                value={maintenanceDraftMessageLine2}
                onChange={(event) => setMaintenanceDraftMessageLine2(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Escribí la segunda línea"
              />

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa</p>
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
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4" onClick={() => setShowLugsPanel(false)}>
            <div className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-boogaloo text-xl text-slate-900">Lista de LUGs</h3>
              </div>

              <div className="mt-3 rounded-md border border-slate-200 p-2">
                <p className="mb-2 text-xs text-slate-500">Doble clic en un LUG para ver su informacion.</p>
                {masterLugsLoading ? (
                  <p className="text-sm text-slate-600">Cargando LUGs...</p>
                ) : masterLugs.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay LUGs cargados.</p>
                ) : (
                  <>
                    {currentUserLug ? (
                      <div className="mb-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tu LUG</p>
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
                            <p className="truncate text-xs opacity-90">{`${currentUserLug.pais ?? "Sin pais"} - ${currentUserLug.members_count} miembros`}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="max-h-[320px] overflow-auto rounded-md border border-slate-200 p-2">
                      {otherLugs.length === 0 ? (
                        <p className="text-sm text-slate-500">No hay otros LUGs para mostrar.</p>
                      ) : (
                        <ul className="space-y-2">
                          {otherLugs.map((lug) => (
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
                                <p className="truncate text-xs text-slate-600">{`${lug.pais ?? "Sin pais"} - ${lug.members_count} miembros`}</p>
                              </div>
                              <button
                                type="button"
                                disabled={requestActionLoadingLugId === lug.lug_id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (lug.open_access) {
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
                                  ? "Procesando..."
                                  : lug.open_access
                                    ? "Entrar directo"
                                    : requestedLugIds.includes(lug.lug_id)
                                    ? "Cancelar solicitud"
                                    : "Solicitar ingreso"}
                              </button>
                            </li>
                          ))}
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
                        Crear nuevo LUG
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
              <h3 className="text-base font-semibold text-slate-900">Solicitar ingreso</h3>
              <p className="mt-1 text-xs text-slate-600">{joinRequestTargetLugName}</p>

              <div className="mt-3 space-y-2">
                <textarea
                  value={joinRequestMessageInput}
                  onChange={(event) => setJoinRequestMessageInput(event.target.value)}
                  rows={3}
                  placeholder="Escribe un mensaje"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={joinRequestSocialInput}
                  onChange={(event) => setJoinRequestSocialInput(event.target.value)}
                  placeholder="Red social"
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
                  {joinRequestSending ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showLugInfoPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowLugInfoPanel(false)}>
            <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">Informacion del LUG</h3>
              </div>

              {lugInfoLoading ? (
                <p className="mt-4 text-sm text-slate-600">Cargando informacion...</p>
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
                        <p className="text-xl font-semibold text-slate-900">{lugInfoData.nombre || "Sin nombre"}</p>
                        <p className="mt-1 text-sm text-slate-600">{lugInfoData.pais || "Sin pais"}</p>
                        <p className="mx-auto mt-4 max-w-[320px] text-sm leading-6 text-slate-700">{lugInfoData.descripcion || "Sin descripcion"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-200 p-3">
                    <h4 className="text-sm font-semibold text-slate-900">Miembros</h4>
                    <div className="mt-2 max-h-[180px] overflow-auto rounded-md border border-slate-200 p-2">
                      {lugInfoData.members.length === 0 ? (
                        <p className="text-sm text-slate-500">No hay miembros cargados.</p>
                      ) : (
                        <ul className="space-y-2">
                          {lugInfoData.members.map((member) => (
                            <li key={member.id} className="rounded-md border border-slate-200 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{member.full_name}</p>
                                  {member.rol_lug === "admin" ? (
                                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                      Admin
                                    </span>
                                  ) : null}
                                </div>
                                {rolLug === "admin" && currentLugId === lugInfoData.lug_id && member.rol_lug !== "admin" ? (
                                  <button
                                    type="button"
                                    onClick={() => void promoteMemberToAdmin(member.id, member.full_name)}
                                    disabled={promoteMemberLoadingId === member.id}
                                    className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
                                  >
                                    {promoteMemberLoadingId === member.id ? "Procesando..." : "Hacer Admin"}
                                  </button>
                                ) : null}
                              </div>
                              <p className="text-xs text-slate-600">
                                {member.social_platform && member.social_handle
                                  ? `${member.social_platform}: ${member.social_handle}`
                                  : "Sin red social"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-600">No pudimos cargar el detalle del LUG.</p>
              )}
            </div>
          </div>
        ) : null}

        {showAdminRequestsPanel ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={() => setShowAdminRequestsPanel(false)}>
            <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl text-slate-900">Solicitudes de ingreso</h3>
                <button
                  type="button"
                  onClick={() => setShowAdminRequestsPanel(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-3 max-h-[320px] overflow-auto rounded-md border border-slate-200 p-2">
                {adminRequestsLoading ? (
                  <p className="text-sm text-slate-600">Cargando solicitudes...</p>
                ) : adminRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay solicitudes pendientes.</p>
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
                              : "Sin red social"}
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
                <h3 className="text-xl text-slate-900">LUGs vacíos</h3>
                <button
                  type="button"
                  onClick={() => setShowMasterEmptyLugsPanel(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-3 max-h-[360px] overflow-auto rounded-md border border-slate-200 p-2">
                {masterEmptyLugsLoading ? (
                  <p className="text-sm text-slate-600">Cargando LUGs vacíos...</p>
                ) : masterEmptyLugs.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay LUGs vacíos pendientes.</p>
                ) : (
                  <ul className="space-y-2">
                    {masterEmptyLugs.map((emptyLug) => (
                      <li key={emptyLug.notification_id} className="rounded-md border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">{emptyLug.nombre || "Sin nombre"}</p>
                        <p className="text-xs text-slate-600">{emptyLug.pais || "Sin pais"}</p>
                        <p className="mt-1 text-xs text-slate-600">{emptyLug.descripcion || "Sin descripcion"}</p>

                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void resolveMasterEmptyLug(emptyLug.notification_id, "delete")}
                            disabled={masterLugActionLoadingId === emptyLug.notification_id}
                            className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700"
                          >
                            Borrar LUG
                          </button>
                          <button
                            type="button"
                            onClick={() => void resolveMasterEmptyLug(emptyLug.notification_id, "open")}
                            disabled={masterLugActionLoadingId === emptyLug.notification_id}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            Dejar abierto
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
              <h3 className="text-base font-semibold text-slate-900">Solicitud de ingreso</h3>
              <p className="mt-2 text-sm font-semibold text-slate-900">{selectedAdminRequest.full_name}</p>
              <p className="mt-1 text-xs text-slate-600">
                {selectedAdminRequest.contact_social
                  ? selectedAdminRequest.contact_social
                  : selectedAdminRequest.social_platform && selectedAdminRequest.social_handle
                    ? `${selectedAdminRequest.social_platform}: ${selectedAdminRequest.social_handle}`
                    : "Sin red social"}
              </p>
              <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {selectedAdminRequest.request_message || "Sin mensaje"}
              </p>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void resolveAdminRequest("rejected")}
                  disabled={adminDecisionLoading}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  onClick={() => void resolveAdminRequest("accepted")}
                  disabled={adminDecisionLoading}
                  className="rounded-md bg-[#006eb2] px-3 py-2 text-sm font-semibold text-white"
                >
                  Aceptar
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
              <h3 className="font-boogaloo text-xl text-slate-900">Crear LUG</h3>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm text-slate-700">Cargar imagen logo (max 500x500)</label>
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
                  <label className="block text-sm text-slate-700">Nombre</label>
                  <input
                    type="text"
                    value={lugNombre}
                    onChange={(event) => setLugNombre(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700">Pais / ciudad</label>
                  <input
                    type="text"
                    value={lugPais}
                    onChange={(event) => setLugPais(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700">Descripcion</label>
                  <textarea
                    value={lugDescripcion}
                    onChange={(event) => setLugDescripcion(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm text-slate-700">Color1</label>
                    <input
                      type="text"
                      value={lugColor1}
                      onChange={(event) => setLugColor1(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700">Color2</label>
                    <input
                      type="text"
                      value={lugColor2}
                      onChange={(event) => setLugColor2(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700">Color3</label>
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
                  Cancelar
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
                  {creatingLug ? "Creando..." : createLugFromListFlow ? "Crear nuevo LUG" : "Crear LUG"}
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
              <p className="text-sm text-slate-900">Si seguís adelante vas a abandonar tu LUG actual.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateLugConfirmPanel(false)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  Cancelar
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
                  OK
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
              <p className="text-sm text-slate-900">Si seguís adelante vas a salir de tu LUG actual.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLugAccessConfirmPanel(false);
                    setPendingLugAccessAction(null);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  Cancelar
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
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}

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
            disabled={loading || !supabase}
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? t.processing : submitText}
          </button>
        </form>

        {status ? <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">{status}</p> : null}

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
