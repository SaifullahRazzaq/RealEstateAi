import mongoose, { Schema, Document, Model } from 'mongoose';
import { AREA_UNITS, type AreaUnit, toSqft, pricePerMarla } from '../lib/area.js';

export type PropertyType =
  | 'plot'
  | 'house'
  | 'flat'
  | 'shop'
  | 'office'
  | 'agricultural'
  | 'file';

export const PROPERTY_TYPES: PropertyType[] = [
  'plot', 'house', 'flat', 'shop', 'office', 'agricultural', 'file',
];

export type PropertyPurpose = 'sale' | 'rent';
export const PROPERTY_PURPOSES: PropertyPurpose[] = ['sale', 'rent'];

/**
 * `token` mirrors the lead pipeline: bayana is held on the property, so it is
 * off the market but not sold. Without it an agent either keeps showing a
 * plot that is spoken for, or writes it off before the transfer completes.
 */
export type PropertyStatus = 'available' | 'token' | 'sold' | 'withdrawn';
export const PROPERTY_STATUSES: PropertyStatus[] = ['available', 'token', 'sold', 'withdrawn'];

export interface IProperty extends Document {
  companyId: mongoose.Types.ObjectId;
  /** Human reference an agent can say on the phone, e.g. "DHA6-1042". */
  code: string;
  title: string;
  type: PropertyType;
  purpose: PropertyPurpose;
  status: PropertyStatus;

  city: string;
  society: string;
  /** Phase, block or sector — the part that actually narrows a search. */
  block?: string;
  plotNo?: string;

  /** What the agent typed, kept so the listing reads back the way it was entered. */
  size: number;
  sizeUnit: AreaUnit;
  /** Normalised. The only field range matching looks at. */
  areaSqft: number;

  /** Demand price in PKR. */
  price: number;
  /** Derived — the figure plots are actually compared on. */
  ratePerMarla: number;

  bedrooms?: number;
  bathrooms?: number;
  corner: boolean;
  parkFacing: boolean;
  boulevard: boolean;
  possessionReady: boolean;

  ownerName?: string;
  ownerPhone?: string;

  notes?: string;
  assignedUser?: mongoose.Types.ObjectId;
  /** Set when the property goes to token or sold, so it can be traced back. */
  linkedLead?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const PropertySchema = new Schema<IProperty>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    code: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: PROPERTY_TYPES, default: 'plot' },
    purpose: { type: String, enum: PROPERTY_PURPOSES, default: 'sale' },
    status: { type: String, enum: PROPERTY_STATUSES, default: 'available' },

    city: { type: String, trim: true, default: '' },
    society: { type: String, trim: true, default: '' },
    block: { type: String, trim: true },
    plotNo: { type: String, trim: true },

    size: { type: Number, default: 0, min: 0 },
    sizeUnit: { type: String, enum: AREA_UNITS, default: 'marla' },
    areaSqft: { type: Number, default: 0, min: 0 },

    price: { type: Number, default: 0, min: 0 },
    ratePerMarla: { type: Number, default: 0, min: 0 },

    bedrooms: { type: Number, min: 0 },
    bathrooms: { type: Number, min: 0 },
    corner: { type: Boolean, default: false },
    parkFacing: { type: Boolean, default: false },
    boulevard: { type: Boolean, default: false },
    possessionReady: { type: Boolean, default: false },

    ownerName: { type: String, trim: true },
    ownerPhone: { type: String, trim: true },

    notes: { type: String, trim: true },
    assignedUser: { type: Schema.Types.ObjectId, ref: 'User' },
    linkedLead: { type: Schema.Types.ObjectId, ref: 'Lead' },
  },
  { timestamps: true }
);

// Derived on write for the same reason commission is: a value recomputed at
// every read eventually disagrees with the one that was stored.
PropertySchema.pre('save', function (this: IProperty) {
  this.areaSqft = toSqft(this.size, this.sizeUnit);
  this.ratePerMarla = pricePerMarla(this.price, this.areaSqft);
});

PropertySchema.index({ companyId: 1, status: 1 });
// The matching query's shape: available stock of a type, filtered on price
// and area ranges.
PropertySchema.index({ companyId: 1, status: 1, type: 1, price: 1 });
PropertySchema.index({ companyId: 1, society: 1 });
PropertySchema.index({ companyId: 1, areaSqft: 1 });
PropertySchema.index({ companyId: 1, createdAt: -1 });
// Free-text search over the fields an agent would type into a search box.
PropertySchema.index({ title: 'text', society: 'text', block: 'text', code: 'text' });

export const Property: Model<IProperty> =
  mongoose.models.Property || mongoose.model<IProperty>('Property', PropertySchema);
