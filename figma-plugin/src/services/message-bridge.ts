import { UIToCodeMessage, CodeToUIMessage } from '../types/messages';

type MessageHandler<T> = (message: T) => void;

/**
 * Message bridge for UI <-> Code sandbox communication
 * Use in UI: MessageBridge.toCode() and MessageBridge.onCodeMessage()
 * Use in Code: MessageBridge is not available (use figma.ui.postMessage directly)
 */
export class MessageBridge {
    private static handlers: Map<string, MessageHandler<any>[]> = new Map();

    /**
     * Send a message from UI to Code sandbox
     */
    static toCode(message: UIToCodeMessage): void {
        parent.postMessage({ pluginMessage: message }, '*');
    }

    /**
     * Register a handler for messages from Code sandbox
     */
    static onCodeMessage<T extends CodeToUIMessage['type']>(
        type: T,
        handler: MessageHandler<Extract<CodeToUIMessage, { type: T }>>
    ): () => void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler);

        // Return unsubscribe function
        return () => {
            const handlers = this.handlers.get(type);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index > -1) {
                    handlers.splice(index, 1);
                }
            }
        };
    }

    /**
     * Initialize the message listener - call once in UI
     */
    static init(): void {
        window.onmessage = (event) => {
            const message = event.data?.pluginMessage as CodeToUIMessage;
            if (!message || !message.type) return;

            const handlers = this.handlers.get(message.type);
            if (handlers) {
                handlers.forEach((handler) => handler(message));
            }
        };
    }

    /**
     * Clean up all handlers
     */
    static destroy(): void {
        this.handlers.clear();
        window.onmessage = null;
    }
}

/**
 * Helper for Code sandbox to send messages to UI
 * This is a simple wrapper around figma.ui.postMessage
 */
export function postToUI(message: CodeToUIMessage): void {
    figma.ui.postMessage(message);
}
