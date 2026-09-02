"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AccountPageSkeleton } from "../../components/LoadingSkeletons";
import { createAccountAddress, fetchAccountAddresses, removeAccountAddress, updateAccountAddress } from "../../lib/apiClient";
import styles from "../account.module.css";

const EMPTY_ADDRESS = {
  addressType: "shipping",
  label: "",
  firstName: "",
  lastName: "",
  company: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateProvince: "",
  postalCode: "",
  country: "",
  isDefault: false,
};

function addressTitle(address) {
  return address.label || (address.addressType === "billing" ? "Billing address" : "Shipping address");
}

function formatAddress(address) {
  return [
    address.addressLine1,
    address.addressLine2,
    [address.city, address.stateProvince, address.postalCode].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean);
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetchAccountAddresses()
      .then((result) => active && setAddresses(Array.isArray(result?.addresses) ? result.addresses : []))
      .catch((loadError) => active && setError(loadError.message || "Unable to load your addresses"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const groups = useMemo(() => ({
    shipping: addresses.filter((address) => address.addressType === "shipping"),
    billing: addresses.filter((address) => address.addressType === "billing"),
  }), [addresses]);

  function openNew(type = "shipping") {
    setEditingId(null);
    setForm({ ...EMPTY_ADDRESS, addressType: type });
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function openEdit(address) {
    setEditingId(address.id);
    setForm({ ...EMPTY_ADDRESS, ...address });
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_ADDRESS);
  }

  function updateField(event) {
    const { name, type, checked, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      setSaving(true);
      if (editingId) {
        const result = await updateAccountAddress(editingId, form);
        setAddresses((current) => current.map((address) => address.id === editingId ? result.address : address));
        setSuccess("Address updated successfully.");
      } else {
        const result = await createAccountAddress(form);
        setAddresses((current) => [...current.map((address) => address.addressType === result.address.addressType && result.address.isDefault ? { ...address, isDefault: false } : address), result.address]);
        setSuccess("Address saved successfully.");
      }
      closeForm();
    } catch (saveError) {
      setError(saveError.message || "Unable to save address");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(address) {
    if (!window.confirm(`Remove ${addressTitle(address).toLowerCase()}?`)) return;
    setPendingId(address.id);
    setError("");
    setSuccess("");
    try {
      await removeAccountAddress(address.id);
      setAddresses((current) => current.filter((entry) => entry.id !== address.id));
      setSuccess("Address removed.");
    } catch (removeError) {
      setError(removeError.message || "Unable to remove address");
    } finally {
      setPendingId(null);
    }
  }

  if (loading) return <AccountPageSkeleton variant="settings" />;

  return (
    <div className={styles.subPage}>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>DELIVERY DETAILS</p>
          <div className={styles.heroTitle}>Addresses</div>
          <div className={styles.heroSub}>Save shipping and billing addresses for a faster checkout.</div>
        </div>
        <button className={styles.primaryBtn} type="button" onClick={() => openNew()}>Add address</button>
      </div>

      {(error || success) && <div className={error ? styles.savedError : styles.savedNotice} role="status">{error || success}</div>}

      {formOpen && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>{editingId ? "Edit address" : "Add an address"}</div>
              <div className={styles.panelSubtitle}>Required fields are marked by the browser.</div>
            </div>
            <button className={styles.ghostBtn} type="button" onClick={closeForm}>Cancel</button>
          </div>
          <form className={styles.accountForm} onSubmit={handleSubmit}>
            <div className={styles.addressTypeSwitch}>
              <label><input type="radio" name="addressType" value="shipping" checked={form.addressType === "shipping"} onChange={updateField} /> Shipping address</label>
              <label><input type="radio" name="addressType" value="billing" checked={form.addressType === "billing"} onChange={updateField} /> Billing address</label>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.formField}><span>Address label <em>Optional</em></span><input className={styles.formInput} name="label" value={form.label} onChange={updateField} placeholder="Home, Office" /></label>
              <label className={styles.formField}><span>First name</span><input className={styles.formInput} name="firstName" value={form.firstName} onChange={updateField} autoComplete="given-name" required /></label>
              <label className={styles.formField}><span>Last name</span><input className={styles.formInput} name="lastName" value={form.lastName} onChange={updateField} autoComplete="family-name" required /></label>
              <label className={styles.formField}><span>Company <em>Optional</em></span><input className={styles.formInput} name="company" value={form.company} onChange={updateField} autoComplete="organization" /></label>
              <label className={styles.formField}><span>Phone <em>Optional</em></span><input className={styles.formInput} name="phone" type="tel" value={form.phone} onChange={updateField} autoComplete="tel" /></label>
              <label className={styles.formField}><span>Address line 1</span><input className={styles.formInput} name="addressLine1" value={form.addressLine1} onChange={updateField} autoComplete="address-line1" required /></label>
              <label className={styles.formField}><span>Address line 2 <em>Optional</em></span><input className={styles.formInput} name="addressLine2" value={form.addressLine2} onChange={updateField} autoComplete="address-line2" /></label>
              <label className={styles.formField}><span>City</span><input className={styles.formInput} name="city" value={form.city} onChange={updateField} autoComplete="address-level2" required /></label>
              <label className={styles.formField}><span>State / province <em>Optional</em></span><input className={styles.formInput} name="stateProvince" value={form.stateProvince} onChange={updateField} autoComplete="address-level1" /></label>
              <label className={styles.formField}><span>Postal code</span><input className={styles.formInput} name="postalCode" value={form.postalCode} onChange={updateField} autoComplete="postal-code" required /></label>
              <label className={styles.formField}><span>Country</span><input className={styles.formInput} name="country" value={form.country} onChange={updateField} autoComplete="country-name" required /></label>
            </div>
            <label className={styles.checkboxRow}><input type="checkbox" name="isDefault" checked={form.isDefault} onChange={updateField} /> <span>Make this my default {form.addressType} address</span></label>
            <div className={styles.formFooter}><span /><button className={styles.primaryBtn} type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save address" : "Add address"}</button></div>
          </form>
        </section>
      )}

      <div className={styles.addressGroups}>
        {["shipping", "billing"].map((type) => (
          <section className={styles.panel} key={type}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>{type === "shipping" ? "Shipping addresses" : "Billing addresses"}</div>
                <div className={styles.panelSubtitle}>{type === "shipping" ? "Where should we send your orders?" : "For invoices and payment records."}</div>
              </div>
              <button className={styles.textButton} type="button" onClick={() => openNew(type)}>Add</button>
            </div>
            {groups[type].length === 0 ? (
              <div className={styles.emptyInline}><span>No {type} address saved yet.</span><button className={styles.secondaryBtn} type="button" onClick={() => openNew(type)}>Add address</button></div>
            ) : (
              <div className={styles.addressList}>
                {groups[type].map((address) => (
                  <article className={styles.addressCard} key={address.id}>
                    <div className={styles.addressCardHeader}><div><strong>{addressTitle(address)}</strong>{address.isDefault && <span className={styles.defaultBadge}>Default</span>}</div><span>{address.firstName} {address.lastName}</span></div>
                    <div className={styles.addressLines}>{formatAddress(address).map((line) => <span key={line}>{line}</span>)}</div>
                    {address.phone && <small className={styles.addressPhone}>{address.phone}</small>}
                    <div className={styles.addressActions}><button className={styles.textButton} type="button" onClick={() => openEdit(address)}>Edit</button><button className={styles.dangerButton} type="button" onClick={() => handleRemove(address)} disabled={pendingId === address.id}>{pendingId === address.id ? "Removing..." : "Remove"}</button></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <p className={styles.formHint}>You can also update delivery details during checkout. Need help? <Link href="/account/support">Contact support</Link>.</p>
    </div>
  );
}
