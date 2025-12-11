import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  id: string;
  children: (args: {
    setNodeRef: (node: HTMLElement | null) => void;
    attributes: any;
    listeners: any;
    style: React.CSSProperties;
    isDragging: boolean;
  }) => React.ReactNode;
  disabled?: boolean;
}

export const SortableItem: React.FC<SortableItemProps> = ({ id, children, disabled }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 99 : 'auto',
  };

  return (
    <>
      {children({
        setNodeRef,
        attributes,
        listeners,
        style,
        isDragging
      })}
    </>
  );
};