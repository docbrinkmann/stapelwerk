'use client';

import { useDraggable } from '@dnd-kit/core';
import { ServiceCard } from '@/components/ServiceCard';
import type { Service } from '@/types/service-browser';

/**
 * Wraps a catalog ServiceCard so it can be dragged onto a stack drop zone.
 *
 * The inner ServiceCard keeps its own click-to-preview behaviour — the parent
 * DndContext uses a pointer activation distance, so a plain click never starts
 * a drag. Keyboard users still add via the preview modal, so we deliberately
 * do not spread dnd-kit's `attributes` here (they would nest a second button
 * role inside the card's <button>).
 */
export function DraggableServiceCard({ service }: { service: Service }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: `catalog-service-${service.id}`,
    data: { service },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={{ touchAction: 'none' }}
      className={`h-full w-full cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
      data-testid="draggable-service"
    >
      {/* w-full/h-full so the card fills the grid cell — as the direct grid
          item it stretched automatically, but wrapped it must be told to. */}
      <ServiceCard service={service} compact={false} className="w-full h-full" />
    </div>
  );
}
