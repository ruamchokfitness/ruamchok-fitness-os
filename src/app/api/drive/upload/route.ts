import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileBase64, folderId, credentials } = await req.json();

    if (!fileName || !fileBase64) {
      return NextResponse.json(
        { success: false, error: 'Missing fileName or fileBase64' },
        { status: 400 }
      );
    }

    const targetFolderId =
      folderId ||
      process.env.GOOGLE_DRIVE_FOLDER_ID ||
      '1CHwB12PBX0rBT0nQGYbg2MTlwAZq48xp';

    // 1. Check environment variables first
    let clientEmail =
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      process.env.GDRIVE_CLIENT_EMAIL;
    let privateKey =
      process.env.GOOGLE_PRIVATE_KEY ||
      process.env.GDRIVE_PRIVATE_KEY;

    // 2. Check credentials passed from Firestore settings if env vars are not set
    if ((!clientEmail || !privateKey) && credentials) {
      clientEmail = credentials.client_email;
      privateKey = credentials.private_key;
    }

    if (!clientEmail || !privateKey) {
      return NextResponse.json(
        {
          success: false,
          notConfigured: true,
          message:
            'Google Service Account credentials are not configured yet. Please configure them in Settings tab.',
        },
        { status: 200 }
      );
    }

    // Clean private key formatting (convert literal \n to actual newlines)
    const cleanKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: cleanKey,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Strip data URL prefix if present
    const base64Data = fileBase64
      .replace(/^data:application\/pdf;base64,/, '')
      .replace(/^data:.*?;base64,/, '');

    const buffer = Buffer.from(base64Data, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType: 'application/pdf',
        body: stream,
      },
      fields: 'id, name, webViewLink',
    });

    return NextResponse.json({
      success: true,
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
    });
  } catch (error: any) {
    console.error('Google Drive API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Google Drive API upload failed',
      },
      { status: 500 }
    );
  }
}
