import type { Editor } from '@tiptap/core';
import { TableMap } from '@tiptap/pm/tables';

import { ToolbarButton } from './ToolbarButton';

type TableCommand = {
  label: string;
  run: () => boolean;
  canRun: () => boolean;
  minimumDimension?: 'row' | 'column';
};

function currentTableDimensions(editor: Editor): { rows: number; columns: number } | undefined {
  const { $from } = editor.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);

    if (node.type.name === 'table') {
      const tableMap = TableMap.get(node);

      return { rows: tableMap.height, columns: tableMap.width };
    }
  }

  return undefined;
}

export function TableControls({ editor, readOnly }: { editor: Editor; readOnly: boolean }) {
  const dimensions = currentTableDimensions(editor);
  const isInTable = editor.isActive('table');
  const tableCommands: readonly TableCommand[] = [
    {
      label: '위에 행 추가',
      run: () => editor.chain().focus().addRowBefore().run(),
      canRun: () => editor.can().chain().focus().addRowBefore().run(),
    },
    {
      label: '아래에 행 추가',
      run: () => editor.chain().focus().addRowAfter().run(),
      canRun: () => editor.can().chain().focus().addRowAfter().run(),
    },
    {
      label: '행 삭제',
      run: () => editor.chain().focus().deleteRow().run(),
      canRun: () => editor.can().chain().focus().deleteRow().run(),
      minimumDimension: 'row',
    },
    {
      label: '왼쪽에 열 추가',
      run: () => editor.chain().focus().addColumnBefore().run(),
      canRun: () => editor.can().chain().focus().addColumnBefore().run(),
    },
    {
      label: '오른쪽에 열 추가',
      run: () => editor.chain().focus().addColumnAfter().run(),
      canRun: () => editor.can().chain().focus().addColumnAfter().run(),
    },
    {
      label: '열 삭제',
      run: () => editor.chain().focus().deleteColumn().run(),
      canRun: () => editor.can().chain().focus().deleteColumn().run(),
      minimumDimension: 'column',
    },
    {
      label: '표 삭제',
      run: () => editor.chain().focus().deleteTable().run(),
      canRun: () => editor.can().chain().focus().deleteTable().run(),
    },
  ];

  const canRunTableCommand = (command: TableCommand): boolean => {
    if (command.minimumDimension === 'row' && (dimensions?.rows ?? 0) <= 1) {
      return false;
    }

    if (command.minimumDimension === 'column' && (dimensions?.columns ?? 0) <= 1) {
      return false;
    }

    return command.canRun();
  };

  return (
    <>
      {!isInTable ? (
        <ToolbarButton
          label="표 삽입"
          disabled={
            readOnly ||
            !editor
              .can()
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          onClick={() => {
            if (!readOnly) {
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            }
          }}
        >
          표 삽입
        </ToolbarButton>
      ) : null}
      {isInTable
        ? tableCommands.map((command) => (
            <ToolbarButton
              key={command.label}
              label={command.label}
              disabled={readOnly || !canRunTableCommand(command)}
              onClick={() => {
                if (!readOnly) {
                  command.run();
                }
              }}
            >
              {command.label}
            </ToolbarButton>
          ))
        : null}
    </>
  );
}
