import { NextRequest, NextResponse } from 'next/server';
import { parseTimeEntryMessage } from '@/lib/discord-parser';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 });
    }
    const result = parseTimeEntryMessage(message);
    return NextResponse.json({ input: message, parsed: result });
  } catch (error) {
    return NextResponse.json({
      error: 'Erro ao processar mensagem',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  const examples = [
    {
      description: 'Formato correto',
      message: `📆 Data: 15/01/2024\n🕐 Hora De Entrada: 09:00\n🕐 Hora De Saída: 18:00`,
    },
    {
      description: 'Sem hora de saída (ERRO)',
      message: `📆 Data:12/07/2026\n🕐 Hora De Entrada:01:03\n🕐 Pausa:09:42\n🕐 Hora De Saída:\n🖊️ Resumo\n• Patrulha com alguém`,
    },
  ];

  const results = examples.map(ex => ({
    ...ex,
    parsed: parseTimeEntryMessage(ex.message),
  }));

  return NextResponse.json({ examples: results });
}
