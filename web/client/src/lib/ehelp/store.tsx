"use client"

import * as React from "react"

import { SEED } from "./seed"
import type {
  Application,
  Customer,
  Dependent,
  EhelpState,
  InternalAccount,
  Permission,
  Recommendation,
  RegionalOverride,
  Role,
  Template,
} from "./types"
import { ROLE_LABEL } from "./types"

const STORAGE_KEY = "ehelp-admin-state-v1"

interface EhelpStore {
  state: EhelpState
  hydrated: boolean
  can: (perm: Permission) => boolean
  actorLabel: () => string
  cooldownBlock: (app: Application) => string | null
  registerCustomer: (c: Omit<Customer, "id">) => void
  verifyFaceScan: (customerId: string) => void
  setDisbursementPref: (customerId: string, pref: Customer["disbursementPref"]) => void
  registerDependent: (d: Omit<Dependent, "id" | "status">) => void
  validateDependent: (dependentId: string) => void
  fileApplication: (a: Omit<Application, "id" | "status" | "updatedAt">) => void
  moveApplication: (id: string, status: Application["status"], note?: string) => void
  saveTemplate: (t: Template) => void
  saveOverride: (o: RegionalOverride) => void
  submitRecommendation: (r: Omit<Recommendation, "id" | "status">) => void
  actRecommendation: (id: string) => void
  registerAccount: (a: Omit<InternalAccount, "id" | "status">) => void
  approveAccount: (id: string) => void
  setRbac: (role: Role, perm: Permission, granted: boolean) => void
}

const StoreContext = React.createContext<EhelpStore | null>(null)

let counter = 0
function nextId(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${counter}`
}

export function EhelpProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<EhelpState>(SEED)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) setState(JSON.parse(raw) as EhelpState)
      } catch {
        // corrupted local state falls back to seed
      }
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state, hydrated])

  const store = React.useMemo<EhelpStore>(() => {
    const { session } = state

    const actorLabel = () =>
      session.role === "dswd-admin"
        ? ROLE_LABEL[session.role]
        : `${ROLE_LABEL[session.role]} · ${session.region}`

    const audit = (prev: EhelpState, action: string, detail: string): EhelpState => ({
      ...prev,
      audit: [
        {
          id: nextId("AUD"),
          ts: new Date().toISOString(),
          actor: actorLabel(),
          action,
          detail,
        },
        ...prev.audit,
      ],
    })

    const mutate = (action: string, detail: string, fn: (prev: EhelpState) => EhelpState) =>
      setState((prev) => audit(fn(prev), action, detail))

    return {
      state,
      hydrated,
      actorLabel,

      can: (perm) => state.rbac[session.role]?.includes(perm) ?? false,

      cooldownBlock: (app) => {
        const customer = state.customers.find((c) => c.id === app.customerId)
        const template = state.templates.find((t) => t.id === app.templateId)
        if (!customer || !template) return "Missing customer or template record"
        if (customer.faceScan !== "Verified") return "Customer face scan not verified"
        if (customer.disbursementPref === "—") return "No disbursement preference set"
        if (!customer.lastDisbursedAt) return null
        const override = state.overrides.find(
          (o) => o.templateId === template.id && o.region === app.region
        )
        const cooldown = override?.cooldownDays ?? template.cooldownDays
        const elapsed =
          (Date.now() - new Date(customer.lastDisbursedAt).getTime()) / 86_400_000
        if (elapsed < cooldown) {
          return `Cooldown active — ${Math.ceil(cooldown - elapsed)} of ${cooldown} days remaining`
        }
        return null
      },

      registerCustomer: (c) => {
        const id = nextId("CUS")
        mutate("customer.registered", `${id} ${c.name} (${c.region})`, (prev) => ({
          ...prev,
          customers: [{ ...c, id }, ...prev.customers],
        }))
      },

      verifyFaceScan: (customerId) =>
        mutate("customer.face-verified", `${customerId} face scan verified`, (prev) => ({
          ...prev,
          customers: prev.customers.map((c) =>
            c.id === customerId ? { ...c, faceScan: "Verified" } : c
          ),
        })),

      setDisbursementPref: (customerId, pref) =>
        mutate("customer.disbursement-pref", `${customerId} → ${pref}`, (prev) => ({
          ...prev,
          customers: prev.customers.map((c) =>
            c.id === customerId ? { ...c, disbursementPref: pref } : c
          ),
        })),

      registerDependent: (d) => {
        const id = nextId("DEP")
        mutate("dependent.registered", `${id} ${d.name} → ${d.customerId}`, (prev) => ({
          ...prev,
          dependents: [{ ...d, id, status: "Pending Validation" }, ...prev.dependents],
        }))
      },

      validateDependent: (dependentId) =>
        mutate("dependent.validated", `${dependentId} activated`, (prev) => ({
          ...prev,
          dependents: prev.dependents.map((d) =>
            d.id === dependentId ? { ...d, status: "Active" } : d
          ),
        })),

      fileApplication: (a) => {
        const id = nextId("APP")
        mutate("application.filed", `${id} for ${a.customerId} (${a.templateId})`, (prev) => ({
          ...prev,
          applications: [
            {
              ...a,
              id,
              status: a.filedBy === "Evaluator" ? "In Evaluation" : "Submitted",
              updatedAt: new Date().toISOString(),
            },
            ...prev.applications,
          ],
        }))
      },

      moveApplication: (id, status, note) =>
        mutate(`application.${status.toLowerCase().replace(/ /g, "-")}`, `${id}${note ? ` — ${note}` : ""}`, (prev) => ({
          ...prev,
          applications: prev.applications.map((a) =>
            a.id === id
              ? { ...a, status, note: note ?? a.note, updatedAt: new Date().toISOString() }
              : a
          ),
          customers:
            status === "Disbursed"
              ? prev.customers.map((c) =>
                  c.id === prev.applications.find((a) => a.id === id)?.customerId
                    ? { ...c, lastDisbursedAt: new Date().toISOString() }
                    : c
                )
              : prev.customers,
        })),

      saveTemplate: (t) =>
        mutate("template.saved", `${t.id} ${t.name} (cooldown ${t.cooldownDays}d)`, (prev) => ({
          ...prev,
          templates: prev.templates.some((x) => x.id === t.id)
            ? prev.templates.map((x) => (x.id === t.id ? t : x))
            : [...prev.templates, t],
        })),

      saveOverride: (o) =>
        mutate("template.customized", `${o.templateId} for ${o.region}`, (prev) => ({
          ...prev,
          overrides: [
            ...prev.overrides.filter(
              (x) => !(x.templateId === o.templateId && x.region === o.region)
            ),
            o,
          ],
        })),

      submitRecommendation: (r) => {
        const id = nextId("REC")
        mutate("recommendation.submitted", `${id} ${r.subject} (${r.priority})`, (prev) => ({
          ...prev,
          recommendations: [{ ...r, id, status: "Open" }, ...prev.recommendations],
        }))
      },

      actRecommendation: (id) =>
        mutate("recommendation.acted", `${id} marked acted`, (prev) => ({
          ...prev,
          recommendations: prev.recommendations.map((r) =>
            r.id === id ? { ...r, status: "Acted" } : r
          ),
        })),

      registerAccount: (a) => {
        const id = nextId("ACC")
        mutate("account.registered", `${id} ${a.name} as ${ROLE_LABEL[a.role]}`, (prev) => ({
          ...prev,
          accounts: [{ ...a, id, status: "Pending Approval" }, ...prev.accounts],
        }))
      },

      approveAccount: (id) =>
        mutate("account.approved", `${id} activated`, (prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === id ? { ...a, status: "Active" } : a
          ),
        })),

      setRbac: (role, perm, granted) =>
        mutate("rbac.changed", `${ROLE_LABEL[role]}: ${perm} → ${granted ? "granted" : "revoked"}`, (prev) => ({
          ...prev,
          rbac: {
            ...prev.rbac,
            [role]: granted
              ? [...prev.rbac[role], perm]
              : prev.rbac[role].filter((p) => p !== perm),
          },
        })),
    }
  }, [state, hydrated])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useEhelp() {
  const ctx = React.useContext(StoreContext)
  if (!ctx) throw new Error("useEhelp must be used inside <EhelpProvider>")
  return ctx
}
