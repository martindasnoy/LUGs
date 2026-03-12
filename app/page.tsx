"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getSupabaseClient } from "@/lib/supabase/client";
import { type UiLanguage, uiLanguageLabels, uiLanguages, uiTranslations } from "@/lib/i18n/ui";

type Mode = "login" | "register";

const FACE_TOTAL = 20;

type SocialPlatform = "instagram" | "facebook" | "";

type LugListItem = {
  id: string;
  owner_id: string | null;
  name: string;
  country_city: string | null;
  description: string | null;
  logo_data_url: string | null;
  lug_language: string | null;
  ui_color1: string;
  ui_color2: string;
  ui_color3: string;
  ui_color4: string;
  members_count: number;
  user_role: "admin" | "member" | "none";
  membership_status: "active" | "pending" | "suspended" | "none";
};

type LugMemberItem = {
  user_id: string;
  role: string;
  display_name: string;
};

export default function Home() {
  const supabase = getSupabaseClient();
  const [mode, setMode] = useState<Mode>("login");
  const [language, setLanguage] = useState<UiLanguage>(() => {
    if (typeof window === "undefined") {
      return "es";
    }

    const stored = window.localStorage.getItem("ui_language");
    if (stored && uiLanguages.includes(stored as UiLanguage)) {
      return stored as UiLanguage;
    }

    return "es";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentLugId, setCurrentLugId] = useState<string | null>(null);
  const [currentMembershipStatus, setCurrentMembershipStatus] = useState<"active" | "pending" | "suspended" | "none">("none");
  const [isMaster, setIsMaster] = useState(false);
  const [displayName, setDisplayName] = useState("Martin Dasnoy");
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [settingsNameInput, setSettingsNameInput] = useState("");
  const [settingsEmailInput, setSettingsEmailInput] = useState("");
  const [settingsSocialPlatform, setSettingsSocialPlatform] = useState<SocialPlatform>("instagram");
  const [settingsSocialHandle, setSettingsSocialHandle] = useState("");
  const [settingsLanguageInput, setSettingsLanguageInput] = useState<UiLanguage>("es");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [settingsPasswordInput, setSettingsPasswordInput] = useState("");
  const [settingsPasswordConfirmInput, setSettingsPasswordConfirmInput] = useState("");
  const [settingsLugName, setSettingsLugName] = useState("Sin LUG asignado");
  const [settingsLugRole, setSettingsLugRole] = useState<"admin" | "member" | "none">("none");
  const [settingsLugLoading, setSettingsLugLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [selectedFace, setSelectedFace] = useState(1);
  const [showFacePicker, setShowFacePicker] = useState(false);
  const [previewFace, setPreviewFace] = useState(1);
  const [showLugsPanel, setShowLugsPanel] = useState(false);
  const [showMasterPanel, setShowMasterPanel] = useState(false);
  const [userHasLug, setUserHasLug] = useState(false);
  const [showLugGate, setShowLugGate] = useState(false);
  const [lugsListLoading, setLugsListLoading] = useState(false);
  const [availableLugs, setAvailableLugs] = useState<LugListItem[]>([]);
  const [showCreateLugPopup, setShowCreateLugPopup] = useState(false);
  const [creatingLug, setCreatingLug] = useState(false);
  const [newLugName, setNewLugName] = useState("");
  const [newLugCountryCity, setNewLugCountryCity] = useState("");
  const [newLugDescription, setNewLugDescription] = useState("");
  const [newLugLanguage, setNewLugLanguage] = useState<UiLanguage>("es");
  const [newLugLogoDataUrl, setNewLugLogoDataUrl] = useState<string | null>(null);
  const [newLugLogoError, setNewLugLogoError] = useState("");
  const [lugsCallInfo, setLugsCallInfo] = useState("");
  const [showLugMembersPopup, setShowLugMembersPopup] = useState(false);
  const [lugMembersTitle, setLugMembersTitle] = useState("");
  const [lugMembersLoading, setLugMembersLoading] = useState(false);
  const [lugMembers, setLugMembers] = useState<LugMemberItem[]>([]);
  const [showLugPropertiesPopup, setShowLugPropertiesPopup] = useState(false);
  const [editingLugId, setEditingLugId] = useState<string | null>(null);
  const [editLugLogoDataUrl, setEditLugLogoDataUrl] = useState<string | null>(null);
  const [editLugLogoError, setEditLugLogoError] = useState("");
  const [editLugName, setEditLugName] = useState("");
  const [editLugCountryCity, setEditLugCountryCity] = useState("");
  const [editLugDescription, setEditLugDescription] = useState("");
  const [editLugLanguage, setEditLugLanguage] = useState<UiLanguage>("es");
  const [editUiColor1, setEditUiColor1] = useState("#006eb2");
  const [editUiColor2, setEditUiColor2] = useState("#f3f4f6");
  const [editUiColor3, setEditUiColor3] = useState("#111827");
  const [editUiColor4, setEditUiColor4] = useState("#ffffff");
  const [savingLugProperties, setSavingLugProperties] = useState(false);

  const t = useMemo(() => uiTranslations[language], [language]);

  const title = useMemo(
    () => (mode === "register" ? t.createAccount : t.signIn),
    [mode, t.createAccount, t.signIn],
  );

  function handleLanguageChange(nextLanguage: UiLanguage) {
    setLanguage(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ui_language", nextLanguage);
    }
  }

  function parseAvatarFace(avatarKey: string | null | undefined) {
    const raw = String(avatarKey ?? "");
    const maybeNum = Number(raw.replace("Cabeza_", "").replace(".png", ""));
    if (Number.isFinite(maybeNum) && maybeNum >= 1 && maybeNum <= FACE_TOTAL) {
      return maybeNum;
    }
    return 1;
  }

  const loadCreatedLugs = useCallback(async (currentUserId?: string | null, currentLugIdParam?: string | null) => {
    const effectiveUserId = currentUserId ?? userId;
    const effectiveCurrentLugId = currentLugIdParam ?? currentLugId;

    if (!supabase || !effectiveUserId) {
      return;
    }

    setLugsListLoading(true);

    const rpcResult = await supabase.rpc("get_lugs_panel_data");

    if (!rpcResult.error) {
      const rpcRows = (rpcResult.data ?? []) as Array<Record<string, unknown>>;
      const normalizedRpc: LugListItem[] = rpcRows.map((lug) => {
        const ownerId = lug.owner_id ? String(lug.owner_id) : null;
        const roleRaw = String(lug.user_role ?? "none");
        const statusRaw = String(lug.membership_status ?? "none");

        const userRole: LugListItem["user_role"] =
          roleRaw === "admin" || roleRaw === "member" ? roleRaw : "none";
        const membershipStatus: LugListItem["membership_status"] =
          statusRaw === "active" || statusRaw === "pending" || statusRaw === "suspended"
            ? statusRaw
            : "none";

        return {
          id: String(lug.id),
          owner_id: ownerId,
          name: String(lug.name ?? ""),
          country_city: lug.country_city ? String(lug.country_city) : null,
          description: lug.description ? String(lug.description) : null,
          logo_data_url: lug.logo_data_url ? String(lug.logo_data_url) : null,
          lug_language: lug.lug_language ? String(lug.lug_language) : "es",
          ui_color1: lug.ui_color1 ? String(lug.ui_color1) : "#006eb2",
          ui_color2: lug.ui_color2 ? String(lug.ui_color2) : "#f3f4f6",
          ui_color3: lug.ui_color3 ? String(lug.ui_color3) : "#111827",
          ui_color4: lug.ui_color4 ? String(lug.ui_color4) : "#ffffff",
          members_count: Number(lug.members_count ?? 0),
          user_role: userRole,
          membership_status: membershipStatus,
        };
      });

      setAvailableLugs(normalizedRpc);
      setLugsCallInfo(`Chequeo RPC OK: ${normalizedRpc.length} LUG(s) cargados.`);
      setLugsListLoading(false);
      return;
    }

    setLugsCallInfo(`Chequeo RPC fallo, usando fallback: ${rpcResult.error.message}`);

    const [lugsResultRaw, allMembershipsResult] = await Promise.all([
      supabase
        .from("lugs")
        .select("id, owner_id, name, country_city, description, logo_data_url, lug_language, ui_color1, ui_color2, ui_color3, ui_color4, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("lug_memberships").select("lug_id, user_id, role"),
    ]);

    let data: Array<Record<string, unknown>> = (lugsResultRaw.data ?? []) as Array<Record<string, unknown>>;
    let error = lugsResultRaw.error;

    if (error) {
      const fallback = await supabase
        .from("lugs")
        .select("id, owner_id, name, description")
        .order("created_at", { ascending: false });

      if (!fallback.error) {
        data = (fallback.data ?? []).map((item) => ({
          ...item,
          country_city: null,
          logo_data_url: null,
          lug_language: "es",
          ui_color1: "#006eb2",
          ui_color2: "#f3f4f6",
          ui_color3: "#111827",
          ui_color4: "#ffffff",
        }));
        error = null;
      }
    }

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setLugsListLoading(false);
      return;
    }

    const memberships = allMembershipsResult.error ? [] : allMembershipsResult.data ?? [];
    if (allMembershipsResult.error) {
      setStatus("No pudimos cargar el total de miembros por LUG en este momento.");
    }

    const memberCountByLug = memberships.reduce<Record<string, number>>((acc, item) => {
      acc[item.lug_id] = (acc[item.lug_id] ?? 0) + 1;
      return acc;
    }, {});

    if (effectiveCurrentLugId && data && !data.some((lug) => String(lug.id) === effectiveCurrentLugId)) {
      const ownLugFetch = await supabase
        .from("lugs")
        .select("id, owner_id, name, country_city, description, logo_data_url, lug_language, ui_color1, ui_color2, ui_color3, ui_color4")
        .eq("id", effectiveCurrentLugId)
        .maybeSingle();

      if (ownLugFetch.data) {
        data = [...(data ?? []), ownLugFetch.data];
      }
    }

    const normalized: LugListItem[] = data.map((lug) => {
      const lugId = String(lug.id);
      const ownerId = lug.owner_id ? String(lug.owner_id) : null;
      const isCurrent = lugId === effectiveCurrentLugId;

      const userRole: LugListItem["user_role"] = isCurrent
        ? ownerId === effectiveUserId || settingsLugRole === "admin"
          ? "admin"
          : "member"
        : "none";

      const membershipStatus: LugListItem["membership_status"] = isCurrent
        ? currentMembershipStatus === "none" && ownerId === effectiveUserId
          ? "active"
          : currentMembershipStatus
        : "none";

      return {
        id: lugId,
        owner_id: ownerId,
        name: String(lug.name ?? ""),
        country_city: lug.country_city ? String(lug.country_city) : null,
        description: lug.description ? String(lug.description) : null,
        logo_data_url: lug.logo_data_url ? String(lug.logo_data_url) : null,
        lug_language: lug.lug_language ? String(lug.lug_language) : "es",
        ui_color1: lug.ui_color1 ? String(lug.ui_color1) : "#006eb2",
        ui_color2: lug.ui_color2 ? String(lug.ui_color2) : "#f3f4f6",
        ui_color3: lug.ui_color3 ? String(lug.ui_color3) : "#111827",
        ui_color4: lug.ui_color4 ? String(lug.ui_color4) : "#ffffff",
        members_count: memberCountByLug[lugId] ?? 0,
        user_role: userRole,
        membership_status: membershipStatus,
      };
    });

    normalized.sort((a, b) => {
      if (a.user_role !== "none" && b.user_role === "none") {
        return -1;
      }
      if (a.user_role === "none" && b.user_role !== "none") {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    setAvailableLugs(normalized);
    setLugsListLoading(false);
  }, [currentLugId, currentMembershipStatus, settingsLugRole, supabase, t.errorPrefix, userId]);

  const syncUserDashboard = useCallback(async (user: { id: string; email?: string | null }) => {
    if (!supabase) {
      return;
    }

    setUserEmail(user.email ?? null);
    setUserId(user.id);

    const fallbackUsername = String(user.email ?? "usuario").split("@")[0] || "usuario";
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        username: fallbackUsername,
      },
      { onConflict: "id" },
    );

    const [{ data: profileData, error: profileError }, { data: ownedLug }, { data: anyMembership }, { data: masterFlag }] = await Promise.all([
      supabase
        .from("profiles")
        .select("preferred_language, full_name, avatar_key, is_master, current_lug_id")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("lugs")
        .select("id, name")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("lug_memberships")
        .select("lug_id, role, membership_status, lugs(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.rpc("is_master_user"),
    ]);

    if (profileError) {
      setStatus(`${t.errorPrefix}: ${profileError.message}`);
    }

    const lang = profileData?.preferred_language;
    if (lang === "es" || lang === "en") {
      setLanguage(lang);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ui_language", lang);
      }
    }

    const fullName = String(profileData?.full_name ?? "").trim();
    setDisplayName(fullName || fallbackUsername || "Martin Dasnoy");
    const master = Boolean(masterFlag ?? profileData?.is_master);
    setIsMaster(master);

    const face = parseAvatarFace(profileData?.avatar_key);
    setSelectedFace(face);
    setPreviewFace(face);

    let resolvedCurrentLugId = String(profileData?.current_lug_id ?? "").trim() || null;
    const ownedLugName = String(ownedLug?.name ?? "").trim();
    const anyMembershipLugId = String(anyMembership?.lug_id ?? "").trim() || null;
    const anyMembershipRole = String(anyMembership?.role ?? "").trim();
    const anyMembershipStatus = String(anyMembership?.membership_status ?? "").trim();
    const anyMembershipLugRaw = anyMembership?.lugs as { name?: string }[] | { name?: string } | null;
    const anyMembershipLug = Array.isArray(anyMembershipLugRaw) ? anyMembershipLugRaw[0] : anyMembershipLugRaw;
    const anyMembershipLugName = String(anyMembershipLug?.name ?? "").trim();
    const currentLugIdFromOwned = String(ownedLug?.id ?? "").trim() || null;

    if (!resolvedCurrentLugId && anyMembershipLugId) {
      resolvedCurrentLugId = anyMembershipLugId;
    }

    if (!resolvedCurrentLugId && currentLugIdFromOwned) {
      resolvedCurrentLugId = currentLugIdFromOwned;
    }

    if (resolvedCurrentLugId && resolvedCurrentLugId !== String(profileData?.current_lug_id ?? "").trim()) {
      await supabase
        .from("profiles")
        .update({ current_lug_id: resolvedCurrentLugId })
        .eq("id", user.id);
    }

    setCurrentLugId(resolvedCurrentLugId);

    const { data: currentMembership } = resolvedCurrentLugId
      ? await supabase
          .from("lug_memberships")
          .select("lug_id, role, membership_status, lugs(name)")
          .eq("user_id", user.id)
          .eq("lug_id", resolvedCurrentLugId)
          .maybeSingle()
      : { data: null };

    const effectiveMembership = currentMembership ?? anyMembership;
    const lugRaw = effectiveMembership?.lugs as { name?: string }[] | { name?: string } | null;
    const lug = Array.isArray(lugRaw) ? lugRaw[0] : lugRaw;

    const membershipStatus = String(effectiveMembership?.membership_status ?? anyMembershipStatus ?? (ownedLugName ? "active" : "none")).toLowerCase();
    const normalizedStatus =
      membershipStatus === "active" || membershipStatus === "pending" || membershipStatus === "suspended"
        ? membershipStatus
        : "none";

    setCurrentMembershipStatus(normalizedStatus);

    const hasLug = Boolean(lug?.name || ownedLugName || resolvedCurrentLugId);
    const roleForCurrent = String(effectiveMembership?.role ?? anyMembershipRole);
    const isAdminOnCurrentLug = Boolean(ownedLugName) || roleForCurrent === "owner" || roleForCurrent === "admin";
    const hasActiveLug = Boolean(ownedLugName) || (hasLug && normalizedStatus === "active");

    setSettingsLugName((lug?.name ?? anyMembershipLugName ?? ownedLugName) || "Sin LUG asignado");
    setSettingsLugRole(
      isAdminOnCurrentLug
        ? "admin"
        : hasLug
          ? "member"
          : "none",
    );
    setUserHasLug(hasActiveLug);
    setShowLugGate(!hasActiveLug && !master);

    if (hasLug && normalizedStatus !== "active" && !ownedLugName) {
      setStatus(`Tu estado en el LUG es '${normalizedStatus}'. Espera aprobacion del admin.`);
    }

    await loadCreatedLugs(user.id, resolvedCurrentLugId);

    if (hasActiveLug) {
      setShowCreateLugPopup(false);
    }
  }, [loadCreatedLugs, supabase, t.errorPrefix]);

  async function handleLugLogoFileChange(file: File | null) {
    setNewLugLogoError("");

    if (!file) {
      setNewLugLogoDataUrl(null);
      return;
    }

    const fileDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });

    await new Promise<void>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        if (img.width > 500 || img.height > 500) {
          setNewLugLogoError("La imagen debe ser maximo 500x500 px.");
          setNewLugLogoDataUrl(null);
        } else {
          setNewLugLogoDataUrl(fileDataUrl);
        }
        resolve();
      };
      img.onerror = () => {
        setNewLugLogoError("No pudimos leer la imagen.");
        setNewLugLogoDataUrl(null);
        resolve();
      };
      img.src = fileDataUrl;
    });
  }

  function normalizeHexColor(value: string, fallback: string) {
    const trimmed = value.trim();
    const hexPattern = /^#([0-9a-fA-F]{6})$/;
    return hexPattern.test(trimmed) ? trimmed.toLowerCase() : fallback;
  }

  async function handleEditLugLogoFileChange(file: File | null) {
    setEditLugLogoError("");

    if (!file) {
      return;
    }

    const fileDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });

    await new Promise<void>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        if (img.width > 500 || img.height > 500) {
          setEditLugLogoError("La imagen debe ser maximo 500x500 px.");
          setEditLugLogoDataUrl(null);
        } else {
          setEditLugLogoDataUrl(fileDataUrl);
        }
        resolve();
      };
      img.onerror = () => {
        setEditLugLogoError("No pudimos leer la imagen.");
        setEditLugLogoDataUrl(null);
        resolve();
      };
      img.src = fileDataUrl;
    });
  }

  async function openLugMembersPopup(lug: LugListItem) {
    if (!supabase) {
      return;
    }

    setShowLugMembersPopup(true);
    setLugMembersTitle(lug.name);
    setLugMembersLoading(true);

    const { data, error } = await supabase
      .from("lug_memberships")
      .select("user_id, role, profiles(full_name, username)")
      .eq("lug_id", lug.id)
      .order("created_at", { ascending: true });

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setLugMembers([]);
      setLugMembersLoading(false);
      return;
    }

    const parsed = (data ?? []).map((item) => {
      const profileRaw = item.profiles as
        | { full_name?: string | null; username?: string | null }
        | { full_name?: string | null; username?: string | null }[]
        | null;
      const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
      const display = String(profile?.full_name ?? profile?.username ?? "Usuario").trim() || "Usuario";

      return {
        user_id: item.user_id,
        role: item.role,
        display_name: display,
      };
    });

    setLugMembers(parsed);
    setLugMembersLoading(false);
  }

  async function openLugPropertiesPopup(lug: LugListItem) {
    let fullLug = lug;

    if (supabase) {
      const { data, error } = await supabase
        .from("lugs")
        .select("id, name, country_city, description, logo_data_url, lug_language, ui_color1, ui_color2, ui_color3, ui_color4")
        .eq("id", lug.id)
        .maybeSingle();

      if (data) {
        fullLug = {
          ...lug,
          ...data,
        } as LugListItem;
      } else if (error) {
        setStatus("Algunos campos avanzados del LUG no estan disponibles todavia.");
      }
    }

    setEditingLugId(fullLug.id);
    setEditLugLogoDataUrl(fullLug.logo_data_url);
    setEditLugLogoError("");
    setEditLugName(fullLug.name);
    setEditLugCountryCity(fullLug.country_city ?? "");
    setEditLugDescription(fullLug.description ?? "");
    setEditLugLanguage(fullLug.lug_language === "en" ? "en" : "es");
    setEditUiColor1(normalizeHexColor(fullLug.ui_color1, "#006eb2"));
    setEditUiColor2(normalizeHexColor(fullLug.ui_color2, "#f3f4f6"));
    setEditUiColor3(normalizeHexColor(fullLug.ui_color3, "#111827"));
    setEditUiColor4(normalizeHexColor(fullLug.ui_color4, "#ffffff"));
    setShowLugPropertiesPopup(true);
  }

  async function saveLugProperties() {
    if (!supabase || !editingLugId) {
      return;
    }

    setSavingLugProperties(true);

    const payload = {
      logo_data_url: editLugLogoDataUrl,
      name: editLugName.trim(),
      country_city: editLugCountryCity.trim() || null,
      description: editLugDescription.trim() || null,
      lug_language: editLugLanguage,
      ui_color1: normalizeHexColor(editUiColor1, "#006eb2"),
      ui_color2: normalizeHexColor(editUiColor2, "#f3f4f6"),
      ui_color3: normalizeHexColor(editUiColor3, "#111827"),
      ui_color4: normalizeHexColor(editUiColor4, "#ffffff"),
    };

    if (!payload.name) {
      setStatus("El nombre del LUG es obligatorio.");
      setSavingLugProperties(false);
      return;
    }

    const { error } = await supabase
      .from("lugs")
      .update(payload)
      .eq("id", editingLugId);

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setSavingLugProperties(false);
      return;
    }

    await loadCreatedLugs();
    setShowLugPropertiesPopup(false);
    setStatus("Propiedades del LUG guardadas.");
    setSavingLugProperties(false);
  }

  async function handleCreateLug() {
    if (!supabase || !userId) {
      return;
    }

    if (!newLugName.trim() || !newLugCountryCity.trim()) {
      setStatus("Completa Nombre y Pais/Ciudad para crear el LUG.");
      return;
    }

    if (!newLugLogoDataUrl) {
      setStatus("Carga un logotipo antes de crear el LUG.");
      return;
    }

    setCreatingLug(true);

    const { data: createdLug, error } = await supabase
      .from("lugs")
      .insert({
      owner_id: userId,
      name: newLugName.trim(),
      country_city: newLugCountryCity.trim(),
      description: newLugDescription.trim() || null,
      lug_language: newLugLanguage,
      logo_data_url: newLugLogoDataUrl,
      })
      .select("id")
      .single();

    if (error) {
      setStatus(`${t.errorPrefix}: ${error.message}`);
      setCreatingLug(false);
      return;
    }

    if (createdLug?.id) {
      const { error: membershipError } = await supabase
        .from("lug_memberships")
        .upsert(
          {
            lug_id: createdLug.id,
            user_id: userId,
            role: "admin",
            membership_status: "active",
          },
          { onConflict: "lug_id,user_id" },
        );

      if (membershipError) {
        setStatus(`${t.errorPrefix}: ${membershipError.message}`);
      }

      await supabase
        .from("profiles")
        .update({ current_lug_id: createdLug.id })
        .eq("id", userId);
    }

    setNewLugName("");
    setNewLugCountryCity("");
    setNewLugDescription("");
    setNewLugLanguage("es");
    setNewLugLogoDataUrl(null);
    setNewLugLogoError("");
    setShowCreateLugPopup(false);

    await syncUserDashboard({ id: userId, email: userEmail });

    setStatus("LUG creado correctamente. Quedaste como administrador.");
    setCreatingLug(false);
  }

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const loadCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        await syncUserDashboard({ id: user.id, email: user.email });
      } else {
        setUserEmail(null);
        setUserId(null);
        setCurrentLugId(null);
        setCurrentMembershipStatus("none");
      }
    };

    void loadCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        void syncUserDashboard({ id: session.user.id, email: session.user.email });
      } else {
        setUserEmail(null);
        setUserId(null);
        setDisplayName("Martin Dasnoy");
        setSelectedFace(1);
        setPreviewFace(1);
        setIsMaster(false);
        setCurrentLugId(null);
        setCurrentMembershipStatus("none");
        setUserHasLug(false);
        setShowLugGate(false);
        setShowCreateLugPopup(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, syncUserDashboard]);

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

      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
      } else {
        setStatus(t.accountCreated);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setStatus(`${t.errorPrefix}: ${error.message}`);
      } else {
        setStatus("");
      }
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

  function getFaceImagePath(faceNum: number) {
    const normalized = String(faceNum).padStart(2, "0");
    return `/api/avatar/Cabeza_${normalized}.png`;
  }

  async function openUserSettings() {
    if (!supabase || !userId) {
      return;
    }

    const fallbackUsername = String(userEmail ?? "usuario").split("@")[0] || "usuario";
    await supabase.from("profiles").upsert(
      {
        id: userId,
        username: fallbackUsername,
      },
      { onConflict: "id" },
    );

    setShowUserSettings(true);
    setShowFacePicker(false);
    setShowPasswordFields(false);
    setSettingsPasswordInput("");
    setSettingsPasswordConfirmInput("");
    setSettingsEmailInput(userEmail ?? "");
    setSettingsLugLoading(true);

    const [profileResult, lugResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, social_platform, social_handle, avatar_key, preferred_language")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("lug_memberships")
        .select("role, lugs(name)")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      setStatus(`${t.errorPrefix}: ${profileResult.error.message}`);
    } else {
      const fullName = String(profileResult.data?.full_name ?? fallbackUsername);
      const platform = String(profileResult.data?.social_platform ?? "instagram").toLowerCase();
      const handle = String(profileResult.data?.social_handle ?? "");
      const avatarKey = String(profileResult.data?.avatar_key ?? "");
      const preferredLanguage = String(profileResult.data?.preferred_language ?? language);

      setSettingsNameInput(fullName);
      setSettingsSocialPlatform(platform === "facebook" ? "facebook" : "instagram");
      setSettingsSocialHandle(handle);
      setSettingsLanguageInput(preferredLanguage === "en" ? "en" : "es");

      const maybeNum = Number(avatarKey.replace("Cabeza_", "").replace(".png", ""));
      if (Number.isFinite(maybeNum) && maybeNum >= 1 && maybeNum <= FACE_TOTAL) {
        setSelectedFace(maybeNum);
        setPreviewFace(maybeNum);
      }
    }

    if (lugResult.error) {
      setSettingsLugName("Sin LUG asignado");
      setSettingsLugRole("none");
    } else {
      const lugData = lugResult.data;
      const lugRaw = lugData?.lugs as { name?: string }[] | { name?: string } | null;
      const lug = Array.isArray(lugRaw) ? lugRaw[0] : lugRaw;
      const role = lugData?.role ?? "member";

      if (lug?.name) {
        setSettingsLugName(lug.name);
        setSettingsLugRole(role === "owner" || role === "admin" ? "admin" : "member");
      } else {
        setSettingsLugName("Sin LUG asignado");
        setSettingsLugRole("none");
      }
    }

    setSettingsLugLoading(false);
  }

  async function openPasswordSettings() {
    setShowPasswordFields((prev) => !prev);
  }

  function openLugSettingsModal() {
    setShowLugsPanel(true);
    void loadCreatedLugs();
  }

  async function saveUserSettings() {
    if (!supabase || !userId) {
      return;
    }

    const fallbackUsername = String(userEmail ?? "usuario").split("@")[0] || "usuario";
    await supabase.from("profiles").upsert(
      {
        id: userId,
        username: fallbackUsername,
      },
      { onConflict: "id" },
    );

    setSettingsSaving(true);
    const avatarValue = `Cabeza_${String(selectedFace).padStart(2, "0")}.png`;

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

    setDisplayName(settingsNameInput.trim() || "Martin Dasnoy");

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
      const { error: emailError } = await supabase.auth.updateUser({
        email: settingsEmailInput,
      });

      if (emailError) {
        setStatus(`${t.errorPrefix}: ${emailError.message}`);
        setSettingsSaving(false);
        return;
      }

      setUserEmail(settingsEmailInput);
    }

    if (showPasswordFields) {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: settingsPasswordInput,
      });

      if (passwordError) {
        setStatus(`${t.errorPrefix}: ${passwordError.message}`);
        setSettingsSaving(false);
        return;
      }
    }

    setLanguage(settingsLanguageInput);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ui_language", settingsLanguageInput);
    }

    setShowUserSettings(false);
    setShowFacePicker(false);
    setShowPasswordFields(false);
    setSettingsPasswordInput("");
    setSettingsPasswordConfirmInput("");
    setStatus("Configuracion guardada. Si cambiaste mail o contrasena, usa esos nuevos datos para login.");
    setSettingsSaving(false);
  }

  if (userEmail) {
    const faceSrc = getFaceImagePath(selectedFace);
    const borderColor = "#006eb2";
    const ownLug = availableLugs.find((lug) => lug.user_role !== "none") ?? null;
    const otherLugs = availableLugs.filter((lug) => lug.id !== ownLug?.id);
    const userTypeLabel = isMaster ? "Master" : "Usuario";
    const lugRoleLabel = ownLug?.user_role === "admin" ? "Admin" : ownLug?.user_role === "member" ? "Miembro" : "Sin LUG";

    return (
      <main
        className="bg-lego-tile min-h-screen px-4 py-6 sm:px-6 sm:py-8"
        style={{ backgroundImage: "url('/api/avatar/Tile_BG.jpg')", backgroundRepeat: "repeat" }}
      >
        <div className="mx-auto w-full max-w-[800px]">
          {isMaster ? (
            <button
              type="button"
              className="mb-3 w-full rounded-lg bg-black px-4 py-2 text-left text-sm font-semibold text-white"
              onClick={() => setShowMasterPanel(true)}
            >
              Master
            </button>
          ) : null}
          <div
            className="flex w-full flex-col gap-6 rounded-2xl border-[10px] bg-white p-4 shadow-xl sm:p-8"
            style={{ borderColor }}
          >
          <header className="border-b border-slate-200 pb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center justify-start gap-3">
                <Image src={faceSrc} alt="Avatar minifig" width={80} height={80} unoptimized className="h-20 w-20 object-contain" />
                <h1 className="break-all text-3xl font-semibold text-slate-900 sm:text-5xl">
                  {displayName}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLugsPanel(true);
                  void loadCreatedLugs();
                }}
                className="rounded-lg border border-slate-300 bg-white p-2"
                title="Panel de LUGs"
              >
                <Image
                  src="/api/avatar/Mundo.png"
                  alt="Panel de LUGs"
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 object-contain"
                />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-black">
              <p className="text-base font-medium">{userEmail}</p>
              <span className="rounded-md border border-slate-300 px-2 py-1 text-xs">Usuario: {userTypeLabel}</span>
              <button
                type="button"
                aria-label={t.settingsAria}
                className="rounded-md border border-black/20 p-2"
                title={t.settingsTitle}
                onClick={() => void openUserSettings()}
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
                className="rounded-md border border-black/20 px-3 py-1.5 text-sm"
              >
                {t.logout}
              </button>
            </div>
          </header>

          {showUserSettings ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
              <h3 className="text-xl text-slate-900">Configuracion de usuario</h3>
              <label className="mt-4 block text-sm text-slate-700" htmlFor="settingsDisplayName">
                Nombre
              </label>
              <input
                id="settingsDisplayName"
                type="text"
                value={settingsNameInput}
                onChange={(event) => setSettingsNameInput(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
              />
              <label className="mt-3 block text-sm text-slate-700" htmlFor="settingsEmail">
                Mail
              </label>
              <input
                id="settingsEmail"
                type="email"
                value={settingsEmailInput}
                onChange={(event) => setSettingsEmailInput(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={() => void openPasswordSettings()}
                className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {showPasswordFields ? "Ocultar cambio de contrasena" : "Cambiar contrasena"}
              </button>
              {showPasswordFields ? (
                <>
                  <label className="mt-3 block text-sm text-slate-700" htmlFor="settingsPassword">
                    Nueva contrasena
                  </label>
                  <input
                    id="settingsPassword"
                    type="password"
                    value={settingsPasswordInput}
                    onChange={(event) => setSettingsPasswordInput(event.target.value)}
                    minLength={6}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
                  />
                  <label className="mt-3 block text-sm text-slate-700" htmlFor="settingsPasswordConfirm">
                    Repetir contrasena
                  </label>
                  <input
                    id="settingsPasswordConfirm"
                    type="password"
                    value={settingsPasswordConfirmInput}
                    onChange={(event) => setSettingsPasswordConfirmInput(event.target.value)}
                    minLength={6}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
                  />
                </>
              ) : null}
              <label className="mt-3 block text-sm text-slate-700">Red social</label>
              <div className="mt-3 grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                <select
                  value={settingsSocialPlatform}
                  onChange={(event) => setSettingsSocialPlatform(event.target.value as SocialPlatform)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
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
                  className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
              <label className="mt-3 block text-sm text-slate-700">Idioma</label>
              <select
                value={settingsLanguageInput}
                onChange={(event) => setSettingsLanguageInput(event.target.value as UiLanguage)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
              >
                {uiLanguages.map((option) => (
                  <option key={option} value={option}>
                    {uiLanguageLabels[option]}
                  </option>
                ))}
              </select>
              <label className="mt-3 block text-sm text-slate-700">LUG</label>
              <button
                type="button"
                onClick={openLugSettingsModal}
                disabled={settingsLugLoading}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {settingsLugLoading
                  ? "Cargando LUG..."
                  : settingsLugRole === "admin"
                    ? "LUG (admin)"
                    : "LUG"}
              </button>
              <p className="mt-1 text-xs text-slate-500">{settingsLugName}</p>
              <label className="mt-3 block text-sm text-slate-700">Thumbnail</label>
              <button
                type="button"
                onClick={() => {
                  setPreviewFace(selectedFace);
                  setShowFacePicker(true);
                }}
                className="mt-2 flex h-16 w-16 items-center justify-center rounded-md border border-slate-300 bg-slate-50 p-1"
              >
                <Image
                  src={getFaceImagePath(selectedFace)}
                  alt={`Cara minifig ${selectedFace}`}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </button>
              {showFacePicker ? (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
                  onClick={() => setShowFacePicker(false)}
                >
                  <div
                    className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="text-sm text-slate-700">Doble clic para seleccionar</p>
                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                      {Array.from({ length: FACE_TOTAL }, (_, index) => {
                        const faceNum = index + 1;
                        const isPreview = previewFace === faceNum;
                        return (
                          <button
                            key={`picker-${faceNum}`}
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
                              alt={`Cara minifig ${faceNum}`}
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
                  disabled={settingsSaving}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void saveUserSettings()}
                  disabled={settingsSaving}
                  className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005f9a] disabled:opacity-50"
                >
                  {settingsSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
            </div>
          ) : null}

          {showLugsPanel ? (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4"
              onClick={() => setShowLugsPanel(false)}
            >
              <div
                className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl text-slate-900">Panel de LUGs</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadCreatedLugs()}
                      className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                    >
                      Test llamada
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLugsPanel(false)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
                {lugsCallInfo ? <p className="mt-2 text-xs text-slate-600">{lugsCallInfo}</p> : null}

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Tu LUG</p>
                    {ownLug ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (ownLug.user_role === "admin") {
                            void openLugPropertiesPopup(ownLug);
                          }
                        }}
                        onDoubleClick={() => void openLugMembersPopup(ownLug)}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{ownLug.name}</p>
                            <p className="text-xs text-slate-600">{ownLug.country_city ?? "Sin ubicacion"}</p>
                            <p className="mt-1 text-xs text-slate-600">
                              Miembros: {ownLug.members_count} - Rol LUG: {lugRoleLabel} - Usuario: {userTypeLabel}
                            </p>
                          </div>
                          {ownLug.logo_data_url ? (
                            <Image
                              src={ownLug.logo_data_url}
                              alt={ownLug.name}
                              width={44}
                              height={44}
                              unoptimized
                              className="h-11 w-11 rounded-md border border-slate-200 object-cover"
                            />
                          ) : null}
                        </div>
                      </button>
                    ) : (
                      <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-500">
                        Aun no tienes LUG asignado.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Resto de LUGs</p>
                    <div className="max-h-[300px] space-y-2 overflow-auto rounded-lg border border-slate-200 p-2">
                      {lugsListLoading ? (
                        <p className="p-2 text-sm text-slate-600">Cargando LUGs...</p>
                      ) : otherLugs.length === 0 ? (
                        <p className="p-2 text-sm text-slate-500">No hay mas LUGs para mostrar.</p>
                      ) : (
                        otherLugs.map((lug) => (
                          <button
                            key={lug.id}
                            type="button"
                            onDoubleClick={() => void openLugMembersPopup(lug)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                          >
                            <p className="font-medium text-slate-900">{lug.name}</p>
                            <p className="text-xs text-slate-600">{lug.country_city ?? "Sin ubicacion"}</p>
                            <p className="mt-1 text-xs text-slate-600">Miembros: {lug.members_count}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {showLugMembersPopup ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
              onClick={() => setShowLugMembersPopup(false)}
            >
              <div
                className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl text-slate-900">Miembros - {lugMembersTitle}</h3>
                  <button
                    type="button"
                    onClick={() => setShowLugMembersPopup(false)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="mt-4 max-h-[380px] overflow-auto rounded-lg border border-slate-200 p-3">
                  {lugMembersLoading ? (
                    <p className="text-sm text-slate-600">Cargando miembros...</p>
                  ) : lugMembers.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay miembros para mostrar.</p>
                  ) : (
                    <ul className="space-y-2">
                      {lugMembers.map((member) => (
                        <li key={member.user_id} className="rounded-md border border-slate-200 p-2 text-sm">
                          <span className="font-medium text-slate-900">{member.display_name}</span>
                          <span className="ml-2 text-xs text-slate-600">({member.role})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {showLugPropertiesPopup ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
              onClick={() => setShowLugPropertiesPopup(false)}
            >
              <div
                className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl text-slate-900">Propiedades del LUG</h3>
                  <button
                    type="button"
                    onClick={() => setShowLugPropertiesPopup(false)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm text-slate-700">Logotipo (max 500x500 px)</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleEditLugLogoFileChange(file);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                    {editLugLogoDataUrl ? (
                      <Image
                        src={editLugLogoDataUrl}
                        alt="Logo LUG"
                        width={80}
                        height={80}
                        unoptimized
                        className="mt-2 h-20 w-20 rounded-md border border-slate-200 object-cover"
                      />
                    ) : null}
                    {editLugLogoError ? <p className="mt-1 text-xs text-red-600">{editLugLogoError}</p> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700">Nombre</label>
                    <input
                      type="text"
                      value={editLugName}
                      onChange={(event) => setEditLugName(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700">Pais / ciudad</label>
                    <input
                      type="text"
                      value={editLugCountryCity}
                      onChange={(event) => setEditLugCountryCity(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700">Descripcion</label>
                    <textarea
                      value={editLugDescription}
                      onChange={(event) => setEditLugDescription(event.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700">Idioma</label>
                    <select
                      value={editLugLanguage}
                      onChange={(event) => setEditLugLanguage(event.target.value as UiLanguage)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    >
                      {uiLanguages.map((option) => (
                        <option key={option} value={option}>
                          {uiLanguageLabels[option]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        { value: editUiColor1, setValue: setEditUiColor1 },
                        { value: editUiColor2, setValue: setEditUiColor2 },
                        { value: editUiColor3, setValue: setEditUiColor3 },
                        { value: editUiColor4, setValue: setEditUiColor4 },
                      ].map((item, index) => (
                        <div key={`uicolor-${index}`} className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
                          <input
                            type="color"
                            value={normalizeHexColor(item.value, "#ffffff")}
                            onChange={(event) => item.setValue(event.target.value)}
                            className="h-9 w-9 cursor-pointer rounded border border-slate-300"
                          />
                          <input
                            type="text"
                            value={item.value}
                            onChange={(event) => item.setValue(event.target.value)}
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLugPropertiesPopup(false)}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveLugProperties()}
                    disabled={savingLugProperties}
                    className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005f9a] disabled:opacity-50"
                  >
                    {savingLugProperties ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showMasterPanel ? (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4"
              onClick={() => setShowMasterPanel(false)}
            >
              <div
                className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl text-slate-900">Panel Master</h3>
                  <button
                    type="button"
                    onClick={() => setShowMasterPanel(false)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                  >
                    Cerrar
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-700">
                  Aqui va el panel de master (ancho 700px).
                </p>
              </div>
            </div>
          ) : null}

          {showLugGate && !userHasLug ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4">
              <div className="h-[600px] w-[600px] max-w-full rounded-xl bg-white p-5 shadow-xl">
                <h3 className="text-xl text-slate-900">Selecciona un LUG</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Para continuar necesitas pertenecer a un LUG.
                </p>
                {lugsCallInfo ? <p className="mt-2 text-xs text-slate-600">{lugsCallInfo}</p> : null}

                <div className="mt-4 h-[450px] overflow-auto rounded-lg border border-slate-200 p-3">
                  {lugsListLoading ? (
                    <p className="text-sm text-slate-600">Cargando LUGs...</p>
                  ) : availableLugs.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay LUGs creados todavia.</p>
                  ) : (
                    <ul className="space-y-2">
                      {availableLugs.map((lug) => (
                        <li key={lug.id} className="rounded-md border border-slate-200 p-3">
                          <p className="font-medium text-slate-900">{lug.name}</p>
                          <p className="text-xs text-slate-600">{lug.country_city ?? "Sin ubicacion"}</p>
                          {lug.description ? (
                            <p className="mt-1 text-sm text-slate-700">{lug.description}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadCreatedLugs()}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
                    >
                      Test llamada
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateLugPopup(true)}
                      className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005f9a]"
                    >
                      Crear LUG
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {showCreateLugPopup ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
              <div className="w-full max-w-[700px] rounded-xl bg-white p-5 shadow-xl">
                <h3 className="text-xl text-slate-900">Crear LUG</h3>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm text-slate-700">Logotipo (max 500x500 px)</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleLugLogoFileChange(file);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                    {newLugLogoDataUrl ? (
                      <Image
                        src={newLugLogoDataUrl}
                        alt="Logo LUG"
                        width={80}
                        height={80}
                        unoptimized
                        className="mt-2 h-20 w-20 rounded-md border border-slate-200 object-cover"
                      />
                    ) : null}
                    {newLugLogoError ? <p className="mt-1 text-xs text-red-600">{newLugLogoError}</p> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700">Nombre</label>
                    <input
                      type="text"
                      value={newLugName}
                      onChange={(event) => setNewLugName(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700">Pais / ciudad</label>
                    <input
                      type="text"
                      value={newLugCountryCity}
                      onChange={(event) => setNewLugCountryCity(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700">Descripcion</label>
                    <textarea
                      value={newLugDescription}
                      onChange={(event) => setNewLugDescription(event.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700">Idioma</label>
                    <select
                      value={newLugLanguage}
                      onChange={(event) => setNewLugLanguage(event.target.value as UiLanguage)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
                    >
                      {uiLanguages.map((option) => (
                        <option key={option} value={option}>
                          {uiLanguageLabels[option]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateLugPopup(false)}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCreateLug()}
                    disabled={creatingLug}
                    className="rounded-md bg-[#006eb2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005f9a] disabled:opacity-50"
                  >
                    {creatingLug ? "Creando..." : "Crear LUG"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="bg-lego-tile min-h-screen px-6 py-16"
      style={{ backgroundImage: "url('/api/avatar/Tile_BG.jpg')", backgroundRepeat: "repeat" }}
    >
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-black/10 bg-white p-7 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t.appAccessTitle}</h1>
          <label className="flex items-center gap-2 text-sm">
            <span>{t.language}</span>
            <select
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value as UiLanguage)}
              className="rounded-md border border-black/20 px-2 py-1"
            >
              {uiLanguages.map((option) => (
                <option key={option} value={option}>
                  {uiLanguageLabels[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!supabase ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t.missingEnv}
          </p>
        ) : null}

        <div className="mt-6 flex gap-2 rounded-lg bg-black/5 p-1">
          <button
            className={`w-1/2 rounded-md px-3 py-2 text-sm ${mode === "register" ? "bg-white shadow" : "text-black/70"}`}
            onClick={() => setMode("register")}
            type="button"
          >
            {t.register}
          </button>
          <button
            className={`w-1/2 rounded-md px-3 py-2 text-sm ${mode === "login" ? "bg-white shadow" : "text-black/70"}`}
            onClick={() => setMode("login")}
            type="button"
          >
            {t.login}
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
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
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
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
            {loading ? t.processing : title}
          </button>
        </form>

        {status ? (
          <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">{status}</p>
        ) : null}
      </section>
    </main>
  );
}
