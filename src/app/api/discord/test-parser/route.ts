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
      description: 'Com pausas e ponto-e-vírgula (caso real)',
      message: `📆 Data: 15/07/2026\n🕐 Hora De Entrada: 16:55\n🕐 Pausa: 18:30 as 19;20 E DAS 20:10 as 22:15\n🕐 Hora De Saída: 00:00`,
    },
    {
      description: 'Sem hora de saída (ERRO)',
      message: `📆 Data:12/07/2026\n🕐 Hora De Entrada:01:03\n🕐 Pausa:09:42\n🕐 Hora De Saída:\n🖊️ Resumo\n• Patrulha com alguém`,
    },
    {
      description: 'Com pausas e ponto em vez de dois-pontos',
      message: `📆 Data: 10/07/2026\n🕐 Hora De Entrada: 09.00\n🕐 Pausa: 12.30 as 13.30\n🕐 Hora De Saída: 18.00`,
    },
    {
      description: 'Turno noturno com múltiplas pausas',
      message: `📆 Data: 14/07/2026\n🕐 Hora De Entrada: 22:00\n🕐 Pausa: 01:00 as 01:30 e das 04:00 as 04:15\n🕐 Hora De Saída: 06:00`,
    },
  ];

  const results = examples.map(ex => ({
    ...ex,
    parsed: parseTimeEntryMessage(ex.message),
  }));

  return NextResponse.json({ examples: results });
}
