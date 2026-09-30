import { Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'ws';
import * as Websocket from 'ws';

interface MessagePayload {
	event: string;
	text: string;
}

interface InfoPayload {
	event: string;
	totalClients: number;
}

@WebSocketGateway({ transports: ['websocket'], secure: false })
export class SocketGateway implements OnGatewayInit {
	private logger: Logger = new Logger('SocketEventsGateway');
	private summaryClient: number = 0;

	@WebSocketServer()
	server!: Server;

	public afterInit(server: Server) {
		this.logger.verbose(`WebSocket Server Initialized & total: [${this.summaryClient}]`);
	}

	handleConnection(client: Websocket.WebSocket, ...args: any[]) {
		this.summaryClient++;
		this.logger.verbose(`Connection & total: [${this.summaryClient}]`);

		const infoMsg: InfoPayload = {
			event: 'info',
			totalClients: this.summaryClient,
		};

		this.emitMessage(infoMsg);
	}

	handleDisconnect(client: Websocket.WebSocket) {
		this.summaryClient--;
		this.logger.verbose(`Disconnection & total: [${this.summaryClient}]`);

		const infoMsg: InfoPayload = {
			event: 'info',
			totalClients: this.summaryClient, 
		};

		// Client - disconnect
		this.broadcastMessage(client, infoMsg);
	}

	@SubscribeMessage('message')
	public async handleMessage(client: any, payload: any): Promise<string> {
		const newMessage: MessagePayload = { event: 'message', text: payload };

		this.logger.verbose(`NEW MESSAGE ${payload}`);

		this.emitMessage(newMessage);
		return 'Hello world!';
	}

	private broadcastMessage(sender: Websocket.WebSocket, message: InfoPayload | MessagePayload) {
		this.server.clients.forEach((client) => {
			if (client !== sender && client.readyState === Websocket.OPEN) {
				client.send(JSON.stringify(message));
			}
		});
	}

	private emitMessage(message: InfoPayload | MessagePayload) {
		this.server.clients.forEach((client) => {
			if (client.readyState === Websocket.OPEN) {
				client.send(JSON.stringify(message));
			}
		});
	}
}
