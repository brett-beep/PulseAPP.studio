import { createClient } from 'npm:@base44/sdk@0.8.6';

// Loops.so API integration
const LOOPS_API_URL = 'https://app.loops.so/api/v1/contacts/create';

async function addToLoops(email: string, source: string): Promise<{ success: boolean; error?: string }> {
  const loopsApiKey = Deno.env.get('LOOPS_API_KEY');
  
  if (!loopsApiKey) {
    console.warn('⚠️ LOOPS_API_KEY not configured, skipping Loops integration');
    return { success: false, error: 'API key not configured' };
  }

  try {
    const response = await fetch(LOOPS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loopsApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        source: source || 'waitlist',
        userGroup: 'waitlist',
        subscribed: true,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ [Loops] Contact created successfully:', email);
      return { success: true };
    } else {
      // Handle specific Loops errors
      if (data.message?.includes('already exists') || response.status === 409) {
        console.log('ℹ️ [Loops] Contact already exists:', email);
        return { success: true }; // Consider this a success - they're already in the system
      }
      console.error('❌ [Loops] API error:', data);
      return { success: false, error: data.message || 'Loops API error' };
    }
  } catch (error) {
    console.error('❌ [Loops] Network error:', error.message);
    return { success: false, error: error.message };
  }
}

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
    const signupSource = source || 'landing_page';

    // Create Base44 client with service role (no user auth needed for public waitlist)
    const base44 = createClient({
      appId: Deno.env.get('BASE44_APP_ID'),
      serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY'),
    });

    // Check if email already exists in Base44
    try {
      const existing = await base44.entities.WaitlistSignup.filter({ email: normalizedEmail });
      if (existing && existing.length > 0) {
        return Response.json({ 
          error: 'This email is already on the waitlist!',
          alreadyExists: true 
        }, { 
          status: 409,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }
    } catch (filterError) {
      // Entity might not exist yet, continue with creation
      console.log('Filter check failed (entity may not exist):', filterError.message);
    }

    // Run both operations in parallel for speed
    const [loopsResult, base44Result] = await Promise.allSettled([
      // 1. Add to Loops.so (for email marketing & welcome email)
      addToLoops(normalizedEmail, signupSource),
      
      // 2. Save to Base44 (backup database)
      base44.entities.WaitlistSignup.create({
        email: normalizedEmail,
        signed_up_at: new Date().toISOString(),
        source: signupSource,
        loops_synced: false, // Will update below if Loops succeeds
      }),
    ]);

    // Check results
    const loopsSuccess = loopsResult.status === 'fulfilled' && loopsResult.value.success;
    const base44Success = base44Result.status === 'fulfilled';

    // Log results
    if (loopsSuccess) {
      console.log('✅ [Loops] Synced:', normalizedEmail);
    } else {
      const loopsError = loopsResult.status === 'fulfilled' 
        ? loopsResult.value.error 
        : loopsResult.reason?.message;
      console.error('❌ [Loops] Failed:', loopsError);
    }

    if (base44Success) {
      console.log('✅ [Base44] Saved:', normalizedEmail);
      
      // Update loops_synced flag if Loops succeeded
      if (loopsSuccess && base44Result.value?.id) {
        try {
          await base44.entities.WaitlistSignup.update(base44Result.value.id, {
            loops_synced: true,
          });
        } catch (updateError) {
          console.warn('⚠️ Could not update loops_synced flag:', updateError.message);
        }
      }
    } else {
      console.error('❌ [Base44] Failed:', base44Result.reason?.message);
    }

    // Return success if at least Base44 succeeded (Loops failure shouldn't block signup)
    if (base44Success) {
      return Response.json({ 
        success: true,
        message: 'Successfully joined the waitlist!',
        email: normalizedEmail,
        loopsSynced: loopsSuccess,
      }, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Both failed - this is a real error
    throw new Error('Failed to save signup to database');

  } catch (error) {
    console.error('❌ Waitlist signup error:', error);
    
    // Check for duplicate key error
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return Response.json({ 
        error: 'This email is already on the waitlist!',
        alreadyExists: true 
      }, { 
        status: 409,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    return Response.json({ 
      error: 'Failed to join waitlist. Please try again.',
      details: error.message 
    }, { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
});