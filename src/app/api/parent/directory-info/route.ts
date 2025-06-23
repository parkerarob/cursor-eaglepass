import { NextRequest, NextResponse } from 'next/server';
import { FERPAService } from '@/lib/ferpaService';
import { DirectoryInfoItem } from '@/lib/directoryInfoService';

export async function POST(request: NextRequest) {
  try {
    const { parentId, studentId, studentName, optOutItems } = await request.json();
    
    if (!parentId || !studentId || !studentName || !optOutItems) {
      return NextResponse.json(
        { error: 'Missing required fields: parentId, studentId, studentName, optOutItems' },
        { status: 400 }
      );
    }
    
    await FERPAService.submitDirectoryInfoOptOut(
      parentId,
      studentId,
      studentName,
      optOutItems
    );
    
    return NextResponse.json({
      success: true,
      message: 'Directory information opt-out submitted successfully'
    });
    
  } catch (error) {
    console.error('Directory info opt-out error:', error);
    return NextResponse.json(
      { error: 'Failed to submit directory information opt-out' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const infoType = searchParams.get('infoType');
    
    if (!studentId || !infoType) {
      return NextResponse.json(
        { error: 'Missing required parameters: studentId, infoType' },
        { status: 400 }
      );
    }
    
    // Validate infoType is a valid DirectoryInfoItem
    if (!Object.values(DirectoryInfoItem).includes(infoType as DirectoryInfoItem)) {
      return NextResponse.json(
        { error: 'Invalid infoType parameter' },
        { status: 400 }
      );
    }
    
    const isAllowed = await FERPAService.checkDirectoryInfoPermission(
      studentId, 
      infoType as DirectoryInfoItem
    );
    
    return NextResponse.json({
      allowed: isAllowed,
      studentId,
      infoType
    });
    
  } catch (error) {
    console.error('Check directory info permission error:', error);
    return NextResponse.json(
      { error: 'Failed to check directory information permission' },
      { status: 500 }
    );
  }
} 