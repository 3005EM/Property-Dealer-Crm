import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connect';
import Lead from '@/models/Lead';
import Activity from '@/models/Activity';
import { requireAuth } from '@/lib/middleware/authHelper';

function generateFollowUpSuggestion(lead: {
  status: string;
  priority: string;
  budget: number;
  propertyInterest: string;
  lastActivityAt: Date;
  followUpDate?: Date | null;
  notes: string;
}) {
  const daysSinceActivity = Math.floor(
    (Date.now() - new Date(lead.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const suggestions: string[] = [];
  let urgency: 'high' | 'medium' | 'low' = 'low';
  let recommendedDate = new Date();

  // High priority leads need fast follow-up
  if (lead.priority === 'High') {
    urgency = 'high';
    recommendedDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
    suggestions.push('This is a high-value lead (budget > 20M PKR). Prioritize immediate personal outreach.');
  } else if (lead.priority === 'Medium') {
    urgency = 'medium';
    recommendedDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    suggestions.push('Medium-priority lead. Schedule a follow-up within 2 days for best conversion.');
  } else {
    recommendedDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    suggestions.push('Low-priority lead. A follow-up within 5 days should suffice.');
  }

  // Status-based suggestions
  if (lead.status === 'New') {
    suggestions.push('Lead has not been contacted yet. Send an introductory WhatsApp message with property portfolio.');
  } else if (lead.status === 'Contacted') {
    suggestions.push('Lead has been contacted. Schedule a site visit or virtual tour to move forward.');
  } else if (lead.status === 'In Progress') {
    suggestions.push('Lead is in progress. Share relevant property listings matching their budget and interest.');
  } else if (lead.status === 'Negotiation') {
    suggestions.push('Lead is in negotiation. Prepare final offer documents and schedule a meeting.');
    urgency = 'high';
  }

  // Stale lead
  if (daysSinceActivity > 7) {
    suggestions.push(`No activity for ${daysSinceActivity} days. Re-engage with new property options or market updates.`);
    urgency = urgency === 'low' ? 'medium' : urgency;
  }

  // Property-specific tips
  if (lead.propertyInterest === 'Commercial') {
    suggestions.push('For commercial leads, share ROI projections and rental yield data.');
  } else if (lead.propertyInterest === 'Plot') {
    suggestions.push('Highlight development potential and future area planning for plot leads.');
  }

  const template = generateMessageTemplate(lead);

  return {
    urgency,
    recommendedDate,
    suggestions,
    estimatedConversionChance: lead.priority === 'High' ? '70%' : lead.priority === 'Medium' ? '45%' : '20%',
    messageTemplate: template,
  };
}

function generateMessageTemplate(lead: { name: string; propertyInterest: string; budget: number; status: string }) {
  const budgetStr = `PKR ${(lead.budget / 1_000_000).toFixed(1)}M`;

  if (lead.status === 'New') {
    return `Assalam o Alaikum ${lead.name} sahab,\n\nI'm reaching out from our property consultancy. We have excellent ${lead.propertyInterest} options within your budget of ${budgetStr}.\n\nWould you be available for a brief consultation this week?\n\nJazak Allah Khair`;
  } else if (lead.status === 'Contacted') {
    return `Assalam o Alaikum ${lead.name} sahab,\n\nFollowing up on our recent conversation about ${lead.propertyInterest} properties. I have some new listings that match your requirements perfectly.\n\nShall we schedule a site visit?\n\nJazak Allah Khair`;
  }

  return `Assalam o Alaikum ${lead.name} sahab,\n\nJust checking in regarding your property search. We have some exciting new options available within ${budgetStr}.\n\nPlease let me know your availability.\n\nJazak Allah Khair`;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const lead = await Lead.findById(params.id);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (user!.role === 'agent' && lead.assignedTo?.toString() !== user!.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const suggestion = generateFollowUpSuggestion(lead);
    return NextResponse.json({ suggestion });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
