import { Router } from 'express';
import mongoose from 'mongoose';
import { Property, PROPERTY_TYPES, PROPERTY_STATUSES, PROPERTY_PURPOSES } from '../models/Property.js';
import { Lead } from '../models/Lead.js';
import { ApiError } from '../lib/apiError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, authUser } from '../middleware/auth.js';
import { AREA_UNITS, toSqft, type AreaUnit } from '../lib/area.js';
import { rankProperties, rankLeads, BUDGET_TOLERANCE } from '../services/matching.js';
import { leadScope } from '../lib/scope.js';

export const propertiesRouter = Router();
propertiesRouter.use(requireAuth);

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const param = (v: unknown) => {
  const id = str(v);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError('VALIDATION_ERROR', 'Invalid id.');
  return id;
};

/**
 * Stock belongs to the company, not to an agent. Unlike leads, an agent must
 * be able to see every listing — you cannot match a client against inventory
 * you are not allowed to read.
 */
function propertyScope(user: ReturnType<typeof authUser>) {
  return { companyId: user.companyId };
}

/** Editable in one place so create and update cannot drift apart. */
function applyBody(property: any, body: Record<string, any>) {
  const fields = [
    'code', 'title', 'city', 'society', 'block', 'plotNo',
    'price', 'bedrooms', 'bathrooms',
    'corner', 'parkFacing', 'boulevard', 'possessionReady',
    'ownerName', 'ownerPhone', 'notes',
  ];
  for (const f of fields) if (body[f] !== undefined) property[f] = body[f];

  const enumField = (field: string, allowed: readonly string[]) => {
    if (body[field] === undefined) return;
    if (!allowed.includes(body[field])) {
      throw new ApiError('VALIDATION_ERROR', `Invalid ${field}. Allowed: ${allowed.join(', ')}.`);
    }
    property[field] = body[field];
  };
  enumField('type', PROPERTY_TYPES);
  enumField('purpose', PROPERTY_PURPOSES);
  enumField('status', PROPERTY_STATUSES);

  if (body.sizeUnit !== undefined) {
    if (!AREA_UNITS.includes(body.sizeUnit)) {
      throw new ApiError('VALIDATION_ERROR', `Invalid sizeUnit. Allowed: ${AREA_UNITS.join(', ')}.`);
    }
    property.sizeUnit = body.sizeUnit;
  }
  if (body.size !== undefined) property.size = Number(body.size) || 0;
}

/** GET /api/properties — filterable list. */
propertiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const query: Record<string, unknown> = propertyScope(user);

    const status = str(req.query.status);
    const type = str(req.query.type);
    const society = str(req.query.society);
    const search = str(req.query.search);

    if (status && PROPERTY_STATUSES.includes(status as any)) query.status = status;
    if (type && PROPERTY_TYPES.includes(type as any)) query.type = type;
    if (society) query.society = { $regex: society, $options: 'i' };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { society: { $regex: search, $options: 'i' } },
        { block: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { plotNo: { $regex: search, $options: 'i' } },
      ];
    }

    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
      query.price = {
        ...(Number.isFinite(minPrice) ? { $gte: minPrice } : {}),
        ...(Number.isFinite(maxPrice) ? { $lte: maxPrice } : {}),
      };
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const [properties, total] = await Promise.all([
      Property.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('assignedUser', 'name email')
        .lean(),
      Property.countDocuments(query),
    ]);

    res.json({
      properties,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

/** GET /api/properties/stats — the counters the list header shows. */
propertiesRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const agg = await Property.aggregate([
      { $match: propertyScope(user) },
      { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$price' } } },
    ]);

    const byStatus: Record<string, { count: number; value: number }> = {};
    for (const row of agg) byStatus[row._id] = { count: row.count, value: row.value };

    res.json({
      total: agg.reduce((n, r) => n + r.count, 0),
      available: byStatus.available?.count || 0,
      onToken: byStatus.token?.count || 0,
      sold: byStatus.sold?.count || 0,
      availableValue: byStatus.available?.value || 0,
    });
  })
);

/** GET /api/properties/:id */
propertiesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const property = await Property.findOne({ _id: param(req.params.id), ...propertyScope(user) })
      .populate('assignedUser', 'name email');
    if (!property) throw new ApiError('NOT_FOUND', 'Property not found.');
    res.json({ property });
  })
);

/**
 * GET /api/properties/:id/matches — which clients want this listing.
 *
 * Read when new stock arrives: the answer is usually already in the CRM.
 */
propertiesRouter.get(
  '/:id/matches',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const property = await Property.findOne({ _id: param(req.params.id), ...propertyScope(user) });
    if (!property) throw new ApiError('NOT_FOUND', 'Property not found.');

    // Closed leads are not prospects. Agents still only match their own.
    const leads = await Lead.find({ ...leadScope(user), status: { $nin: ['won', 'lost'] } })
      .populate('assignedUser', 'name')
      .limit(500);

    const minScore = Number(req.query.minScore);
    const ranked = rankLeads(property, leads, Number.isFinite(minScore) ? minScore : 40);

    res.json({
      property,
      matches: ranked.slice(0, 25).map((m) => ({ lead: m.lead, score: m.score, reasons: m.reasons })),
    });
  })
);

/** POST /api/properties */
propertiesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const body = req.body ?? {};
    if (!str(body.title)) throw new ApiError('VALIDATION_ERROR', 'Title is required.');

    const property = new Property({
      companyId: user.companyId,
      assignedUser: body.assignedUser || user.id,
      title: str(body.title),
    });
    applyBody(property, body);
    await property.save();

    res.status(201).json({ property });
  })
);

/** PATCH /api/properties/:id */
propertiesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const property = await Property.findOne({ _id: param(req.params.id), ...propertyScope(user) });
    if (!property) throw new ApiError('NOT_FOUND', 'Property not found.');

    applyBody(property, req.body ?? {});
    if (req.body?.linkedLead !== undefined) {
      property.linkedLead = req.body.linkedLead ? param(req.body.linkedLead) as any : undefined;
    }
    await property.save();

    res.json({ property });
  })
);

/** DELETE /api/properties/:id */
propertiesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const result = await Property.deleteOne({ _id: param(req.params.id), ...propertyScope(user) });
    if (!result.deletedCount) throw new ApiError('NOT_FOUND', 'Property not found.');
    res.json({ ok: true });
  })
);

/**
 * GET /api/properties/match/lead/:leadId — stock that fits this client.
 *
 * The query narrows on the cheap indexed fields first and the engine scores
 * what survives, so a near-miss on price still reaches the ranker instead of
 * being dropped by the database.
 */
propertiesRouter.get(
  '/match/lead/:leadId',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const lead = await Lead.findOne({ _id: param(req.params.leadId), ...leadScope(user) });
    if (!lead) throw new ApiError('NOT_FOUND', 'Lead not found.');

    const req_ = lead.requirement;
    const query: Record<string, unknown> = { ...propertyScope(user), status: 'available' };

    if (req_?.types?.length) query.type = { $in: req_.types };
    if (req_?.purpose) query.purpose = req_.purpose;
    // Widened by the same tolerance the scorer forgives, so the database never
    // discards a row the ranker would have kept.
    if (req_?.maxBudget > 0) query.price = { $lte: Math.round(req_.maxBudget * (1 + BUDGET_TOLERANCE)) };

    const properties = await Property.find(query).limit(500);

    const minScore = Number(req.query.minScore);
    const ranked = rankProperties(lead, properties, Number.isFinite(minScore) ? minScore : 40);

    res.json({
      lead,
      matches: ranked.slice(0, 25).map((m) => ({ property: m.property, score: m.score, reasons: m.reasons })),
    });
  })
);

/** PATCH /api/leads/:id/requirement lives here so the area maths stays in one file. */
propertiesRouter.patch(
  '/requirement/:leadId',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const lead = await Lead.findOne({ _id: param(req.params.leadId), ...leadScope(user) });
    if (!lead) throw new ApiError('NOT_FOUND', 'Lead not found.');

    const body = req.body ?? {};
    const r = lead.requirement;

    if (body.types !== undefined) {
      const types = Array.isArray(body.types) ? body.types : [];
      const bad = types.find((t: string) => !PROPERTY_TYPES.includes(t as any));
      if (bad) throw new ApiError('VALIDATION_ERROR', `Invalid property type "${bad}".`);
      r.types = types;
    }
    if (body.purpose !== undefined) r.purpose = body.purpose || undefined;
    if (body.minBudget !== undefined) r.minBudget = Number(body.minBudget) || 0;
    if (body.maxBudget !== undefined) r.maxBudget = Number(body.maxBudget) || 0;
    if (body.locations !== undefined) {
      r.locations = (Array.isArray(body.locations) ? body.locations : []).map(str).filter(Boolean);
    }
    if (body.intent !== undefined) r.intent = body.intent || undefined;
    if (body.notes !== undefined) r.notes = str(body.notes);

    // Sizes arrive in whatever unit the agent typed; only sq ft is stored.
    const unit: AreaUnit = AREA_UNITS.includes(body.areaUnit) ? body.areaUnit : r.areaUnit || 'marla';
    r.areaUnit = unit;
    if (body.minArea !== undefined) r.minAreaSqft = toSqft(Number(body.minArea) || 0, unit);
    if (body.maxArea !== undefined) r.maxAreaSqft = toSqft(Number(body.maxArea) || 0, unit);

    await lead.save();
    res.json({ lead });
  })
);
