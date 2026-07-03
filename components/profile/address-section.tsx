"use client";

import { useActionState, useRef } from "react";
import { motion, useInView } from "motion/react";

import { deleteAddressAction, setDefaultAddressAction, type ProfileActionState } from "@/app/profile/actions";

const ease = [0.22, 1, 0.36, 1] as const;

type AddressRecord = {
  id: string;
  type: string;
  firstName: string;
  lastName: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  countryCode: string;
  phone: string | null;
};

type AddressProfile = {
  id: string;
  defaultAddressId: string | null;
  phone: string | null;
  addresses: AddressRecord[];
} | null;

type Props = { addressProfile: AddressProfile };

function AddressCard({
  address,
  isDefault,
  index,
}: {
  address: AddressRecord;
  isDefault: boolean;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [deleteState, deleteFormAction] = useActionState<ProfileActionState, FormData>(deleteAddressAction, {});
  const [defaultState, defaultFormAction] = useActionState<ProfileActionState, FormData>(setDefaultAddressAction, {});

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease, delay: index * 0.07 }}
      className="relative border border-stroke p-6 transition-colors hover:border-foreground/25"
    >
      {isDefault && (
        <div className="absolute left-0 top-0 h-full w-0.5 bg-couture-red" />
      )}

      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          {isDefault && (
            <span className="label-caps mb-2 inline-block text-couture-red/70">Default</span>
          )}
          <p className="font-serif text-lg">
            {address.firstName} {address.lastName}
          </p>
          {address.company && (
            <p className="text-sm text-foreground/50">{address.company}</p>
          )}
        </div>
        <span className="label-caps rounded-none border border-stroke px-2 py-0.5 text-foreground/35">
          {address.type.toLowerCase()}
        </span>
      </div>

      <address className="not-italic space-y-0.5 text-sm text-foreground/65">
        <p>{address.line1}</p>
        {address.line2 && <p>{address.line2}</p>}
        <p>
          {address.city}
          {address.region ? `, ${address.region}` : ""} {address.postalCode}
        </p>
        <p className="text-foreground/40">{address.countryCode}</p>
        {address.phone && <p className="pt-1 text-foreground/40">{address.phone}</p>}
      </address>

      <div className="mt-5 flex items-center gap-4 border-t border-stroke pt-4">
        {!isDefault && (
          <form action={defaultFormAction}>
            <input type="hidden" name="addressId" value={address.id} />
            <button
              type="submit"
              className="label-caps text-foreground/40 transition-colors hover:text-foreground/80"
            >
              Set as default
            </button>
          </form>
        )}

        <form action={deleteFormAction}>
          <input type="hidden" name="addressId" value={address.id} />
          <button
            type="submit"
            className="label-caps text-foreground/30 transition-colors hover:text-couture-red"
          >
            Remove
          </button>
        </form>

        {(deleteState.error || deleteState.success || defaultState.error || defaultState.success) && (
          <span className={`label-caps ml-auto text-xs ${
            deleteState.success || defaultState.success
              ? "text-foreground/60"
              : "text-couture-red"
          }`}>
            {deleteState.error ?? deleteState.success ?? defaultState.error ?? defaultState.success}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function NoAddresses() {
  return (
    <div className="flex flex-col items-start gap-4 border border-stroke px-8 py-12">
      <div className="flex items-center gap-4">
        <div className="h-px w-8 bg-foreground/15" />
        <div className="h-1.5 w-1.5 rotate-45 border border-couture-red/40" />
        <div className="h-px w-8 bg-foreground/15" />
      </div>
      <p className="font-serif text-2xl">No saved addresses.</p>
      <p className="max-w-xs text-sm leading-relaxed text-foreground/50">
        Addresses are saved automatically when you complete an order with a shipping address.
      </p>
    </div>
  );
}

export function AddressSection({ addressProfile }: Props) {
  if (!addressProfile || addressProfile.addresses.length === 0) {
    return <NoAddresses />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {addressProfile.addresses.map((address, i) => (
        <AddressCard
          key={address.id}
          address={address}
          isDefault={address.id === addressProfile.defaultAddressId}
          index={i}
        />
      ))}
    </div>
  );
}
