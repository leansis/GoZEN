import React, { useState, useMemo } from 'react';
import { Pencil, Trash2, ArrowUpDown, Search, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  sortable?: boolean;
  sortAccessor?: (item: T) => string | number;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  searchable?: boolean;
  onReorder?: (items: T[]) => void;
}

function SortableRow<T extends { id: string }>({ 
  item, 
  columns, 
  onEdit, 
  onDelete,
  isDragEnabled
}: { 
  item: T; 
  columns: Column<T>[]; 
  onEdit?: (item: T) => void; 
  onDelete?: (item: T) => void;
  isDragEnabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: isDragging ? 'relative' as const : 'static' as const,
  };

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      className={`bg-white border-b hover:bg-gray-50 ${isDragging ? 'shadow-lg bg-gray-50' : ''}`}
    >
      {isDragEnabled && (
        <td className="px-2 py-4 w-10">
          <div {...attributes} {...listeners} className="cursor-grab hover:text-blue-600 text-gray-400">
            <GripVertical className="w-5 h-5" />
          </div>
        </td>
      )}
      {columns.map((col, i) => (
        <td key={i} className="px-6 py-4">
          {typeof col.accessor === 'function'
            ? col.accessor(item)
            : (item[col.accessor] as React.ReactNode)}
        </td>
      ))}
      {(onEdit || onDelete) && (
        <td className="px-6 py-4 text-right space-x-2">
          {onEdit && (
            <button
              onClick={() => onEdit(item)}
              className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(item)}
              className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

export default function Table<T extends { id: string }>({ columns, data, onEdit, onDelete, searchable = true, onReorder }: TableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: number; direction: 'asc' | 'desc' } | null>(null);
  const [filterText, setFilterText] = useState('');

  const handleSort = (index: number) => {
    if (!columns[index].sortable) return;
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === index && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: index, direction });
  };

  const filteredData = useMemo(() => {
    if (!filterText) return data;
    const lowerFilter = filterText.toLowerCase();
    return data.filter(item => {
      return columns.some(col => {
        let val = '';
        if (typeof col.accessor === 'function') {
          // If there's a sortAccessor, use it for filtering too as it's likely a string representation
          if (col.sortAccessor) {
            val = String(col.sortAccessor(item));
          } else {
            // We can't easily filter on ReactNode, so we skip or try to extract text if possible
            // For simplicity, we'll just skip complex nodes unless sortAccessor is provided
            return false;
          }
        } else {
          val = String(item[col.accessor] || '');
        }
        return val.toLowerCase().includes(lowerFilter);
      });
    });
  }, [data, filterText, columns]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const col = columns[sortConfig.key];
        let aValue: any = '';
        let bValue: any = '';

        if (col.sortAccessor) {
          aValue = col.sortAccessor(a);
          bValue = col.sortAccessor(b);
        } else if (typeof col.accessor !== 'function') {
          aValue = a[col.accessor];
          bValue = b[col.accessor];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorder) {
      const oldIndex = sortedData.findIndex((item) => item.id === active.id);
      const newIndex = sortedData.findIndex((item) => item.id === over.id);
      onReorder(arrayMove(sortedData, oldIndex, newIndex));
    }
  };

  const isDragEnabled = !!onReorder && !filterText && sortConfig === null;

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative w-full md:w-1/3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Buscar..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      )}
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                {isDragEnabled && <th scope="col" className="px-2 py-3 w-10"></th>}
                {columns.map((col, i) => (
                  <th 
                    key={i} 
                    scope="col" 
                    className={`px-6 py-3 ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                    onClick={() => handleSort(i)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{col.header}</span>
                      {col.sortable && <ArrowUpDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </th>
                ))}
                {(onEdit || onDelete) && (
                  <th scope="col" className="px-6 py-3 text-right">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + ((onEdit || onDelete) ? 1 : 0) + (isDragEnabled ? 1 : 0)} className="px-6 py-4 text-center text-gray-500">
                    No hay datos disponibles
                  </td>
                </tr>
              ) : (
                <SortableContext 
                  items={sortedData.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedData.map((item) => (
                    <SortableRow 
                      key={item.id} 
                      item={item} 
                      columns={columns} 
                      onEdit={onEdit} 
                      onDelete={onDelete}
                      isDragEnabled={isDragEnabled}
                    />
                  ))}
                </SortableContext>
              )}
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
