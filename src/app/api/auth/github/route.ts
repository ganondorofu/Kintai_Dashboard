import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    const origin = request.headers.get('origin');

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }
    
    if (!origin) {
        return NextResponse.json({ error: 'Origin header is required' }, { status: 400 });
    }

    const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!;
    const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
    const REDIRECT_URI = `${origin}/auth/callback`;
    
    console.log("Using Redirect URI for token exchange:", REDIRECT_URI);


    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    
    const responseBody = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', responseBody);
      return NextResponse.json({ error: 'Failed to exchange code for token' }, { status: 400 });
    }

    if (responseBody.error) {
      return NextResponse.json({ error: responseBody.error_description || responseBody.error }, { status: 400 });
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
