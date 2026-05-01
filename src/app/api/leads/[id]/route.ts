import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connect';
import Lead from '@/models/Lead';
import Activity from '@/models/Activity';
import User from '@/models/User';
import { requireAuth } from '@/lib/middleware/authHelper';
import { rateLimit } from '@/lib/middleware/rateLimit';
import { sendLeadAssignedEmail } from '@/lib/email';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const rl = rateLimit(req, user!.role);
  if (rl) return rl;

  try {
    await connectDB();
    const lead = await Lead.findById(params.id);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    
    if (user!.role === 'agent' && lead.assignedTo?.toString() !== user!.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    await lead.populate('assignedTo', 'name email phone');

    return NextResponse.json({ lead });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const rl = rateLimit(req, user!.role);
  if (rl) return rl;

  try {
    await connectDB();
    const body = await req.json();

    const lead = await Lead.findById(params.id);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (user!.role === 'agent' && lead.assignedTo?.toString() !== user!.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const prevStatus = lead.status;
    const prevAssignedTo = lead.assignedTo?.toString();
    const prevPriority = lead.priority;

    // Apply updates
    const allowedFields = ['name', 'email', 'phone', 'propertyInterest', 'location', 'budget',
      'status', 'notes', 'source', 'assignedTo', 'followUpDate'];

    for (const field of allowedFields) {
      if (field in body) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (lead as any)[field] = body[field];
      }
    }

    lead.lastActivityAt = new Date();
    await lead.save();
    await lead.populate('assignedTo', 'name email');

    // Track activity
    const activities = [];

    if (body.status && body.status !== prevStatus) {
      activities.push({
        lead: lead._id,
        performedBy: user!.id,
        type: 'status_updated',
        description: `Status changed from ${prevStatus} to ${body.status}`,
        metadata: { from: prevStatus, to: body.status },
      });
    }

    if (body.assignedTo && body.assignedTo !== prevAssignedTo) {
      const agent = await User.findById(body.assignedTo);
      const actType = prevAssignedTo ? 'reassigned' : 'assigned';
      activities.push({
        lead: lead._id,
        performedBy: user!.id,
        type: actType,
        description: `Lead ${actType} to ${agent?.name || 'agent'}`,
        metadata: { agentId: body.assignedTo, agentName: agent?.name },
      });

      // Email agent
      if (agent) {
        await sendLeadAssignedEmail(agent.email, agent.name, {
          id: lead._id.toString(),
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          propertyInterest: lead.propertyInterest,
          budget: lead.budget,
          priority: lead.priority,
          source: lead.source,
        });
      }
    }

    if (body.notes !== undefined && body.notes !== lead.notes) {
      activities.push({
        lead: lead._id,
        performedBy: user!.id,
        type: 'notes_updated',
        description: 'Notes updated',
      });
    }

    if (lead.priority !== prevPriority) {
      activities.push({
        lead: lead._id,
        performedBy: user!.id,
        type: 'priority_changed',
        description: `Priority changed from ${prevPriority} to ${lead.priority}`,
        metadata: { from: prevPriority, to: lead.priority },
      });
    }

    if (body.followUpDate) {
      activities.push({
        lead: lead._id,
        performedBy: user!.id,
        type: 'follow_up_set',
        description: `Follow-up scheduled for ${new Date(body.followUpDate).toLocaleDateString()}`,
        metadata: { date: body.followUpDate },
      });
    }

    if (activities.length > 0) {
      await Activity.insertMany(activities);
    }

    return NextResponse.json({ lead });
  } catch (err) {
    console.error('Update lead error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth('admin');
  if (error) return error;

  try {
    await connectDB();
    const lead = await Lead.findByIdAndDelete(params.id);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    await Activity.deleteMany({ lead: params.id });

    return NextResponse.json({ message: 'Lead deleted successfully' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
