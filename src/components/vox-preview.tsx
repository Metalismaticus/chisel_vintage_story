'use client';

import { useEffect, useRef, useState } from 'react';

// Define the custom element type for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'vox-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
      };
    }
  }
}

interface VoxPreviewProps {
  voxData: Uint8Array;
}

export function VoxPreview({ voxData }: VoxPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const viewerRef = useRef<HTMLElement>(null);
  const [isClient, setIsClient] = useState(false)
 
  // The vox-viewer library relies on window, so we must ensure this component only renders on the client.
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    // Import the library only on the client side
    import('vox-viewer');
  }, []);

  useEffect(() => {
    if (voxData && voxData.length > 0) {
      // Create a Blob from the Uint8Array
      const blob = new Blob([voxData], { type: 'application/octet-stream' });
      // Create an object URL from the Blob
      const url = URL.createObjectURL(blob);
      setObjectUrl(url);

      // Cleanup function to revoke the object URL when the component unmounts or data changes
      return () => {
        URL.revokeObjectURL(url);
        setObjectUrl(null);
      };
    }
  }, [voxData]);
  
  if (!isClient) {
    return null;
  }

  return (
    <div className="w-full h-full min-h-[400px] border border-dashed border-input rounded-lg flex items-center justify-center bg-black/20">
      {objectUrl ? (
        <vox-viewer
          ref={viewerRef}
          src={objectUrl}
          camera-controls
          auto-rotate
          style={{ width: '100%', height: '400px', cursor: 'grab' }}
        />
      ) : (
        <p className="text-muted-foreground">Loading preview...</p>
      )}
    </div>
  );
}
