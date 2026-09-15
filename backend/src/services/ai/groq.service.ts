// ==============================================
// Groq AI Service (Llama 3)
// ==============================================

import Groq from 'groq-sdk';
import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import type { ConversationTurn, AIReplyResult } from '@/types';

const logger = createLogger('ai:groq');

// Initialize Groq client
const groq = new Groq({
  apiKey: config.groqApiKey,
});

// ==============================================
// Generate AI Reply
// ==============================================

/**
 * Generate AI reply with escalation detection
 */
export async function generateAIReply(
  systemPrompt: string,
  conversationHistory: ConversationTurn[],
  userInput: string,
  escalationKeywords: string[]
): Promise<AIReplyResult> {
  try {
    // Check for escalation keywords first (fast path)
    const lowerInput = userInput.toLowerCase();
    const detectedKeyword = escalationKeywords.find((kw) =>
      lowerInput.includes(kw.toLowerCase())
    );

    if (detectedKeyword) {
      logger.info(
        { keyword: detectedKeyword },
        'Escalation keyword detected in user input'
      );
      return {
        reply:
          "I understand you'd like to speak with a human agent. Let me connect you now.",
        shouldEscalate: true,
        reason: `Customer requested: "${detectedKeyword}"`,
      };
    }

    // Build messages array
    const messages: ConversationTurn[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userInput },
    ];

    // Call Groq API with function calling for escalation detection
    const startTime = Date.now();
    const completion = await groq.chat.completions.create({
      model: config.groqModel,
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 150,
      top_p: 1,
      stream: false,
      tools: [
        {
          type: 'function',
          function: {
            name: 'escalate_to_human',
            description:
              'Transfer the customer to a human agent when the AI cannot help or customer is frustrated',
            parameters: {
              type: 'object',
              properties: {
                reason: {
                  type: 'string',
                  description: 'Brief reason for escalation',
                },
              },
              required: ['reason'],
            },
          },
        },
      ],
    });

    const duration = Date.now() - startTime;
    logger.info({ duration, model: config.groqModel }, 'Groq API call completed');

    const response = completion.choices[0];

    // Check if AI called escalation function
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      const toolCall = response.message.tool_calls[0];
      if (toolCall.function?.name === 'escalate_to_human' && toolCall.function.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        logger.info({ reason: args.reason }, 'AI triggered escalation');
        return {
          reply: "Let me connect you with someone who can better assist you.",
          shouldEscalate: true,
          reason: args.reason,
        };
      }
    }

    // Normal AI response
    const reply = response.message.content || "I'm here to help. Could you please repeat that?";

    return {
      reply,
      shouldEscalate: false,
    };
  } catch (error) {
    logger.error({ error, userInput }, 'Error generating AI reply');

    // Fallback response on error
    return {
      reply:
        "I'm experiencing technical difficulties. Let me connect you with a human agent.",
      shouldEscalate: true,
      reason: 'AI service error',
    };
  }
}

// ==============================================
// Generate SMS Reply
// ==============================================

/**
 * Generate AI reply for SMS (shorter, more concise)
 */
export async function generateSMSReply(
  systemPrompt: string,
  conversationHistory: Array<{ sender: string; body: string }>,
  userMessage: string
): Promise<string> {
  try {
    // Convert SMS history to conversation format
    const messages: ConversationTurn[] = [
      {
        role: 'system',
        content: `${systemPrompt}\n\nIMPORTANT: Keep your response under 160 characters. Be concise and helpful.`,
      },
      ...conversationHistory.map((msg) => ({
        role: msg.sender === 'customer' ? ('user' as const) : ('assistant' as const),
        content: msg.body,
      })),
      { role: 'user', content: userMessage },
    ];

    const startTime = Date.now();
    const completion = await groq.chat.completions.create({
      model: config.groqModel,
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 60, // ~160 chars
      top_p: 1,
      stream: false,
    });

    const duration = Date.now() - startTime;
    logger.info({ duration, model: config.groqModel }, 'SMS reply generated');

    return (
      completion.choices[0].message.content ||
      "Thanks for your message. How can I help you?"
    );
  } catch (error) {
    logger.error({ error, userMessage }, 'Error generating SMS reply');
    return "Thanks for reaching out. A team member will respond shortly.";
  }
}

// ==============================================
// Generate Call Summary
// ==============================================

/**
 * Generate summary of call transcript
 */
export async function generateCallSummary(
  transcript: Array<{ speaker: string; content: string }>
): Promise<string> {
  try {
    const transcriptText = transcript
      .map((turn) => `${turn.speaker}: ${turn.content}`)
      .join('\n');

    const completion = await groq.chat.completions.create({
      model: config.groqModel,
      messages: [
        {
          role: 'system',
          content:
            'Summarize the following call transcript in 1-2 sentences. Focus on the main issue and resolution.',
        },
        { role: 'user', content: transcriptText },
      ] as any,
      temperature: 0.3,
      max_tokens: 100,
    });

    return (
      completion.choices[0].message.content ||
      'Call completed.'
    );
  } catch (error) {
    logger.error({ error }, 'Error generating call summary');
    return 'Call transcript available.';
  }
}
