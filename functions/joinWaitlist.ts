import { createClient } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { email, source } = await req.json();

    // Validate email
    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Create Base44 client with app credentials (no user auth needed for waitlist)
    const base44 = createClient({
      appId: Deno.env.get('BASE44_APP_ID'),
      token: Deno.env.get('BASE44_TOKEN'),
    });

    // Check if email already exists
    try {
      const existing = await base44.entities.WaitlistSignup.filter({ email: normalizedEmail });
      if (existing && existing.length > 0) {
        return Response.json({ 
          error: 'This email is already on the waitlist!',
          alreadyExists: true 
        }, { status: 409 });
      }
    } catch (filterError) {
      // Entity might not exist yet, continue with creation
      console.log('Filter check failed (entity may not exist):', filterError.message);
    }

    // Create the signup
    const signup = await base44.entities.WaitlistSignup.create({
      email: normalizedEmail,
      signed_up_at: new Date().toISOString(),
      source: source || 'landing_page',
    });

    console.log('✅ Waitlist signup created:', normalizedEmail);

    return Response.json({ 
      success: true,
      message: 'Successfully joined the waitlist!',
      email: normalizedEmail,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('❌ Waitlist signup error:', error);
    
    // Check for duplicate key error
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return Response.json({ 
        error: 'This email is already on the waitlist!',
        alreadyExists: true 
      }, { status: 409 });
    }

    return Response.json({ 
      error: 'Failed to join waitlist. Please try again.',
      details: error.message 
    }, { status: 500 });
  }
});
