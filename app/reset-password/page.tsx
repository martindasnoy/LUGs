"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = getSupabaseClient();
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let cancelled = false;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setHasSession(Boolean(data.session));
        setCheckingSession(false);
      }
    };

    void syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setHasSession(Boolean(session));
        setCheckingSession(false);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus("Falta configuracion de Supabase.");
      return;
    }
    if (!hasSession) {
      setStatus("El enlace de recuperacion no es valido o ya vencio.");
      return;
    }
    if (password.length < 6) {
      setStatus("La nueva contrasena debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setStatus("Las contrasenas no coinciden.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus(error.message);
      setSaving(false);
      return;
    }

    await supabase.auth.signOut();
    setSaving(false);
    setStatus("Contrasena actualizada. Ya podes iniciar sesion con tu nueva contrasena.");
    setPassword("");
    setPasswordConfirm("");
    setHasSession(false);
  }

  return (
    <main className="bg-lego-tile min-h-screen px-6 py-16">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-black/10 bg-white p-7 text-black shadow-sm">
        <h1 className="text-2xl font-semibold">Recuperar contrasena</h1>
        <p className="mt-2 text-sm text-slate-600">Ingresa tu nueva contrasena para completar la recuperacion.</p>

        {checkingSession ? (
          <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">Validando enlace...</p>
        ) : !hasSession ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">El enlace no es valido o ya vencio. Solicita uno nuevo desde el login.</p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="new-password">
                Nueva contrasena
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="confirm-password">
                Repetir contrasena
              </label>
              <input
                id="confirm-password"
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm outline-none focus:border-black"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar nueva contrasena"}
            </button>
          </form>
        )}

        {status ? <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">{status}</p> : null}

        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-slate-700 underline">
          Volver al login
        </Link>
      </section>
    </main>
  );
}
