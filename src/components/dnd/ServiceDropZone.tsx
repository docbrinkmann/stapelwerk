'use client';

import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

/**
 * Drop target for dragged catalog services. Highlights while a card hovers
 * over it. The parent DndContext's onDragEnd inspects `over.id` to decide
 * whether to add the service, so the id here must match what that handler
 * checks (default: "stack-dropzone").
 */
export function ServiceDropZone({
  id = 'stack-dropzone',
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} transition-shadow ${
        isOver ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      }`}
      data-dropzone-active={isOver}
    >
      {children}
    </div>
  );
}
