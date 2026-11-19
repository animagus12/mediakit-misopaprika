"use client";

import { createContext, Suspense, use, useCallback, useContext, useMemo, useState } from "react";
import { NewCampaignSheet } from "@/components/campaigns/NewCampaignButton";
import { NewContentSheet } from "@/components/calendar/NewContentSheet";
import { NewBrandSheet } from "@/components/brands/NewBrandButton";
import { NewEditorTransactionSheet } from "@/components/workspace/NewEditorTransactionButton";
import { ExpenseSheet } from "@/components/expenses/ExpenseSheet";
import type { CreateKind, CreateMenuData } from "./createActions";

interface CreateMenuContextValue {
  openCreate: (kind: CreateKind) => void;
  /** False in the loading shell, which has read no store and so has nothing to fill the forms with. */
  ready: boolean;
}

const CreateMenuContext = createContext<CreateMenuContextValue | null>(null);

export function useCreateMenu(): CreateMenuContextValue {
  const value = useContext(CreateMenuContext);
  if (!value) throw new Error("useCreateMenu must be used inside CreateMenuProvider");
  return value;
}

/**
 * Holds the one copy of each create form for the whole shell, so the desktop
 * New menu and the phone's create sheet open the same form, on any page,
 * without each page loading what the forms need.
 *
 * The data arrives as an unresolved promise, like the sidebar's counters: the
 * page paints first, and a form picked before it lands opens once it does.
 */
export function CreateMenuProvider({
  data,
  children,
}: Readonly<{
  data?: Promise<CreateMenuData>;
  children: React.ReactNode;
}>) {
  const [active, setActive] = useState<CreateKind | null>(null);
  // The expense form is mounted open and keyed per opening (see ExpenseSheet),
  // so each one starts empty with an id of its own.
  const [expenseKey, setExpenseKey] = useState(0);

  const openCreate = useCallback((kind: CreateKind) => {
    if (kind === "expense") setExpenseKey((key) => key + 1);
    setActive(kind);
  }, []);
  const close = useCallback(() => setActive(null), []);

  const value = useMemo(() => ({ openCreate, ready: data !== undefined }), [openCreate, data]);

  return (
    <CreateMenuContext.Provider value={value}>
      {children}
      {data && (
        <Suspense fallback={null}>
          <CreateSheets data={data} active={active} expenseKey={expenseKey} onClose={close} />
        </Suspense>
      )}
    </CreateMenuContext.Provider>
  );
}

function CreateSheets({
  data,
  active,
  expenseKey,
  onClose,
}: {
  data: Promise<CreateMenuData>;
  active: CreateKind | null;
  expenseKey: number;
  onClose: () => void;
}) {
  const options = use(data);
  const sheet = (kind: CreateKind) => ({
    open: active === kind,
    onOpenChange: (open: boolean) => {
      if (!open) onClose();
    },
  });

  return (
    <>
      <NewCampaignSheet
        {...sheet("campaign")}
        brandOptions={options.campaignBrandOptions}
        videoOptions={options.videoOptions}
      />
      <NewContentSheet {...sheet("post")} videoOptions={options.videoOptions} />
      <NewBrandSheet {...sheet("brand")} agencies={options.agencies} contacts={options.contacts} />
      <NewEditorTransactionSheet {...sheet("editorJob")} editors={options.editors} />
      {active === "expense" && (
        <ExpenseSheet
          key={expenseKey}
          dealOptions={options.expenseDealOptions}
          defaults={options.expenseDefaults}
          onClose={onClose}
        />
      )}
    </>
  );
}
