import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connect';
import User from '@/models/User';
import Lead from '@/models/Lead';
import { requireAuth } from '@/lib/middleware/authHelper';
import { validateBody, signupSchema } from '@/lib/middleware/validation';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth('admin');
  if (error) return error;

  try {
    await connectDB();
    const agents = await User.find({ role: 'agent', isActive: true }).select('-password');

    // Get lead counts per agent
    const agentIds = agents.map((a) => a._id);
    const leadCounts = await Lead.aggregate([
      { $match: { assignedTo: { $in: agentIds } } },
      { $group: { _id: '$assignedTo', total: { $sum: 1 }, closed: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } } } },
    ]);

    const countMap = new Map<string, { total: number; closed: number }>(
  leadCounts.map((l) => [l._id.toString(), { total: l.total, closed: l.closed }])
);

    const agentsWithStats = agents.map((agent) => {
      const stats = countMap.get(agent._id.toString());
      return {
        ...agent.toJSON(),
        stats: {
          totalLeads: stats?.total || 0,
          closedLeads: stats?.closed || 0,
        },
      };
    });

    return NextResponse.json({ agents: agentsWithStats });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth('admin');
  if (error) return error;

  try {
    const body = await req.json();
    const validation = validateBody(signupSchema, { ...body, role: 'agent' });
    if (!validation.valid) return validation.error;

    await connectDB();

    const existing = await User.findOne({ email: validation.data!.email });
    if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });

    const agent = await User.create({ ...validation.data, role: 'agent' });

    return NextResponse.json({ agent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
