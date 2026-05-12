import React, { useState, useCallback, useRef } from "react";
import { Box, Text, Static, useInput } from "ink";
import { buildGraph, runChat } from "@quizz/core";
import { renderEvent } from "./render.js";

type CompiledGraph = ReturnType<typeof buildGraph>;

interface EventLine {
  id: number;
  element: React.ReactElement;
}

interface AppProps {
  graph: CompiledGraph;
  threadId: string;
}

let lineId = 0;
function nextId(): number {
  return ++lineId;
}

export function App({ graph, threadId }: AppProps): React.ReactElement {
  const [eventLines, setEventLines] = useState<EventLine[]>([]);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const streamingRef = useRef(false);

  const pushEventLine = useCallback((element: React.ReactElement) => {
    setEventLines((prev) => [...prev, { id: nextId(), element }]);
  }, []);

  const submit = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || streamingRef.current) return;

      streamingRef.current = true;
      setStreaming(true);
      setInput("");
      setStreamBuffer("");

      pushEventLine(
        <Text bold color="white">
          {`> ${userMessage}`}
        </Text>
      );

      let tokenAccumulator = "";

      try {
        for await (const event of runChat(graph, { threadId, userMessage })) {
          if (event.type === "final.token") {
            tokenAccumulator += event.token;
            setStreamBuffer(tokenAccumulator);
          } else {
            const rendered = renderEvent(event);
            if (rendered !== null) {
              pushEventLine(rendered);
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        pushEventLine(
          <Text color="red">{`[Erreur] ${message}`}</Text>
        );
      }

      if (tokenAccumulator) {
        pushEventLine(<Text dimColor>{tokenAccumulator}</Text>);
      }

      setStreamBuffer("");
      streamingRef.current = false;
      setStreaming(false);
    },
    [graph, threadId, pushEventLine]
  );

  useInput((char, key) => {
    if (streaming) return;

    if (key.return) {
      void submit(input);
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (key.escape || key.ctrl) return;

    if (char) {
      setInput((prev) => prev + char);
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text color="cyan" bold>
          quizz-cours-IA
        </Text>
        <Text>{"  "}</Text>
        <Text dimColor>{`thread: ${threadId}`}</Text>
      </Box>

      <Static items={eventLines}>
        {(line) => <Box key={line.id}>{line.element}</Box>}
      </Static>

      {streamBuffer.length > 0 && (
        <Box>
          <Text>{streamBuffer}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        {streaming ? (
          <Text color="yellow">{"[...] "}</Text>
        ) : (
          <Text color="cyan">{">> "}</Text>
        )}
        <Text>{input}</Text>
        {!streaming && <Text color="gray">{"_"}</Text>}
      </Box>
    </Box>
  );
}
