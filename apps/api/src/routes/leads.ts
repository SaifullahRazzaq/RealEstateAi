import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { Lead, LEAD_STATUSES, type LeadStatus } from '../models/Lead.js';
import { Comment } from '../models/Comment.js';
import { Call } from '../models/Call.js';
import { ApiError } from '../lib/apiError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, requireAdmin, authUser } from '../middleware/auth.js';
import { leadScope } from '../lib/scope.js';

export const leadsRouter = Router();
leadsRouter.use(requireAuth);

/** Express 5 types route params as string | string[]; routes always want the single value. */
const param = (v: unknown): string => (Array.isArray(v) ? v[0] : String(v ?? ''));

const OPEN_STATUSES: LeadStatus[] = ['new', 'incontact', 'followedup', 'due', 'meeting'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** GET /api/leads — filtered, paginated list. */
leadsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = authUser(req);

    const tab = str(req.query.tab);
    const status = str(req.query.status);
    const date = str(req.query.date);
    const search = str(req.query.search);
    const source = str(req.query.source);
    const pipeline = str(req.query.pipeline);
    const sort = str(req.query.sort) || 'recent';
    const page = Math.max(1, parseInt(str(req.query.page) || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(str(req.query.limit) || '10', 10) || 10));
    const skip = (page - 1) * limit;

    // RBAC: agents see only leads assigned to them.
    const query: Record<string, unknown> = { ...leadScope(user) };

    const dateRange = (field: string, value: string) => {
      const start = new Date(value);
      start.setHours(0, 0, 0, 0);
      const end = new Date(value);
      end.setHours(23, 59, 59, 999);
      query[field] = { $gte: start, $lte: end };
    };

    switch (tab) {
      case 'new':
      case 'incontact':
      case 'due':
      case 'followedup':
      case 'lost':
      case 'won':
        query.status = tab;
        break;
      case 'daily':
        query.status = { $in: ['due', 'followedup'] };
        if (date) dateRange('followUpDate', date);
        break;
      case 'pipeline':
        query.isPipeline = true;
        query.status = { $in: OPEN_STATUSES };
        break;
      case 'meeting':
        query.status = 'meeting';
        if (date) dateRange('meetingDate', date);
        break;
      case 'all':
        break;
      default:
        if (status && LEAD_STATUSES.includes(status as LeadStatus)) query.status = status;
    }

    if (pipeline === 'true') query.isPipeline = true;
    if (source) query.source = source;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      recent: { createdAt: -1 },
      oldest: { createdAt: 1 },
      value: { dealValue: -1 },
      name: { name: 1 },
    };

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate('assignedUser', 'name email')
        .sort(sortMap[sort] || sortMap.recent)
        .skip(skip)
        .limit(limit)
        .lean(),
      Lead.countDocuments(query),
    ]);

    res.json({
      leads,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  })
);

/** GET /api/leads/export — xlsx download. Declared before /:id so it isn't shadowed. */
leadsRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const tab = str(req.query.tab) || 'all';

    const query: Record<string, unknown> = { ...leadScope(user) };

    if (tab === 'pipeline') query.isPipeline = true;
    else if (tab === 'meeting') query.status = 'meeting';
    else if (tab === 'daily') query.status = { $in: ['due', 'followedup'] };
    else if (LEAD_STATUSES.includes(tab as LeadStatus)) query.status = tab;

    const leads = await Lead.find(query).populate('assignedUser', 'name email').lean();

    const rows = leads.map((l: any) => ({
      Name: l.name,
      Phone: l.phone,
      Email: l.email || '',
      Company: l.company || '',
      Source: l.source || '',
      Status: l.status,
      DealValue: l.dealValue || 0,
      WonValue: l.wonValue || 0,
      Pipeline: l.isPipeline ? 'Yes' : 'No',
      FollowUpDate: l.followUpDate ? new Date(l.followUpDate).toISOString().split('T')[0] : '',
      MeetingDate: l.meetingDate ? new Date(l.meetingDate).toISOString().split('T')[0] : '',
      AssignedTo: l.assignedUser?.name || '',
      CreatedAt: new Date(l.createdAt).toISOString().split('T')[0],
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="leads-${tab}-${Date.now()}.xlsx"`);
    res.send(buffer);
  })
);

/** Pull a value from a row using any of several possible header spellings. */
function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find((h) => h.trim().toLowerCase() === k.toLowerCase());
    if (found && row[found] != null && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
}

/** POST /api/leads/import — bulk create from an uploaded sheet. */
leadsRouter.post(
  '/import',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const user = authUser(req);

    if (!req.file) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'No file uploaded. Send multipart/form-data with a `file` field.'
      );
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch {
      throw new ApiError('VALIDATION_ERROR', 'File could not be parsed. Upload a valid .xlsx or .csv.');
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
    if (!data.length) throw new ApiError('VALIDATION_ERROR', 'Empty file or invalid format.');

    let skipped = 0;
    const leads = data
      .map((row) => {
        const name = pick(row, ['name', 'full name', 'contact', 'lead']);
        const phone = pick(row, ['phone', 'mobile', 'contact number', 'number', 'phone number']);
        if (!name || !phone) {
          skipped++;
          return null;
        }
        const raw = pick(row, ['dealvalue', 'deal value', 'value', 'amount', 'budget']).replace(/[^0-9.]/g, '');
        const value = Number(raw);
        return {
          name,
          phone,
          email: pick(row, ['email', 'email address']),
          company: pick(row, ['company', 'business', 'organization']),
          source: pick(row, ['source', 'lead source', 'channel']) || 'Import',
          dealValue: Number.isFinite(value) ? value : 0,
          status: 'new' as const,
          assignedUser: user.id,
          companyId: user.companyId,
          statusHistory: [{ from: 'new', to: 'new', by: user.id, at: new Date(), note: 'Imported' }],
        };
      })
      .filter(Boolean);

    if (!leads.length) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'No valid rows found. Ensure the file has Name and Phone columns.'
      );
    }

    const inserted = await Lead.insertMany(leads);
    res.status(201).json({ imported: inserted.length, skipped });
  })
);

/** POST /api/leads — create one lead. */
leadsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const { name, phone, email, company, source, dealValue } = req.body ?? {};

    if (!name || !phone) {
      throw new ApiError('VALIDATION_ERROR', 'Name and phone are required.');
    }

    const lead = await Lead.create({
      name,
      phone,
      email,
      company,
      source: source || 'Manual',
      dealValue: Number(dealValue) || 0,
      status: 'new',
      assignedUser: user.id,
      companyId: user.companyId,
      statusHistory: [{ from: 'new', to: 'new', by: user.id, at: new Date(), note: 'Lead created' }],
    });

    res.status(201).json({ lead });
  })
);

/** GET /api/leads/:id */
leadsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const lead = await Lead.findOne({ _id: param(req.params.id), ...leadScope(user) })
      .populate('assignedUser', 'name email')
      .lean();

    if (!lead) throw new ApiError('NOT_FOUND', 'Lead not found.');
    res.json({ lead });
  })
);

/** PATCH /api/leads/:id — edit fields and/or move status. */
leadsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const body = req.body ?? {};

    const lead = await Lead.findOne({ _id: param(req.params.id), ...leadScope(user) });
    if (!lead) throw new ApiError('NOT_FOUND', 'Lead not found.');

    const editable = [
      'name', 'phone', 'email', 'company', 'source',
      'dealValue', 'wonValue', 'followUpDate', 'isPipeline', 'meetingDate',
    ] as const;
    for (const key of editable) {
      if (body[key] !== undefined) (lead as any)[key] = body[key];
    }

    if (body.status && body.status !== lead.status) {
      if (!LEAD_STATUSES.includes(body.status as LeadStatus)) {
        throw new ApiError('VALIDATION_ERROR', `Invalid status. Allowed: ${LEAD_STATUSES.join(', ')}.`);
      }
      const to = body.status as LeadStatus;
      lead.statusHistory.push({
        from: lead.status,
        to,
        by: user.id as any,
        at: new Date(),
        note: body.moveNote,
      });
      lead.status = to;

      // Won — capture realised value (fallback to dealValue)
      if (to === 'won' && !lead.wonValue) {
        lead.wonValue = body.wonValue !== undefined ? Number(body.wonValue) : lead.dealValue;
      }
      // Closing a deal takes it out of the pipeline either way.
      if (to === 'won' || to === 'lost') lead.isPipeline = false;
    }

    await lead.save();
    const populated = await lead.populate('assignedUser', 'name email');
    res.json({ lead: populated });
  })
);

/** DELETE /api/leads/:id — admin only. */
leadsRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    await Lead.findOneAndDelete({ _id: param(req.params.id), companyId: user.companyId });
    res.json({ message: 'Lead deleted' });
  })
);

/** GET /api/leads/:id/comments */
leadsRouter.get(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const user = authUser(req);

    const lead = await Lead.findOne({ _id: param(req.params.id), ...leadScope(user) });
    if (!lead) throw new ApiError('NOT_FOUND', 'Lead not found.');

    const comments = await Comment.find({ leadId: param(req.params.id) })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ comments });
  })
);

/** POST /api/leads/:id/comments — add a note, optionally logging a call. */
leadsRouter.post(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const { comment, logCall } = req.body ?? {};

    if (!comment) throw new ApiError('VALIDATION_ERROR', 'Comment text is required.');

    const lead = await Lead.findOne({ _id: param(req.params.id), ...leadScope(user) });
    if (!lead) throw new ApiError('NOT_FOUND', 'Lead not found.');

    const newComment = await Comment.create({
      leadId: param(req.params.id),
      userId: user.id,
      comment,
    });

    if (logCall) {
      await Call.create({ leadId: param(req.params.id), userId: user.id, companyId: user.companyId });
    }

    const populated = await newComment.populate('userId', 'name');
    res.status(201).json({ comment: populated });
  })
);
