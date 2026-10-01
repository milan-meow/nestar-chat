import { Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'ws';
import * as Websocket from 'ws';
import { AuthService } from '../components/auth/auth.service';
import { Member } from '../libs/dto/member/member';
import * as url from 'url';

interface MessagePayload {
	event: string;
	text: string;
}

interface InfoPayload {
	event: string;
	totalClients: number;
	memberData: Member | null;
	action: string;
}

@WebSocketGateway({ transports: ['websocket'], secure: false })
export class SocketGateway implements OnGatewayInit {
	private logger: Logger = new Logger('SocketEventsGateway');
	private summaryClient: number = 0;
	private clientAuthMap = new Map<Websocket.WebSocket, Member | null>();
	private messageList: MessagePayload[] = [];

	constructor(private authService: AuthService) {}

	@WebSocketServer()
	server!: Server;

	public afterInit(server: Server) {
		this.logger.verbose(`WebSocket Server Initialized & total: [${this.summaryClient}]`);
	}

	private async retrieveAuth(req: any): Promise<Member | null> {
		try {
			const parseUrl = url.parse(req.url, true);
			const { token } = parseUrl.query;
			// console.log('token: ', token);
			return await this.authService.verifyToken(token as string);
		} catch (err) {
			return null;
		}
	}

	public async handleConnection(client: Websocket.WebSocket, req: any) {
		const authMember = await this.retrieveAuth(req);
		this.summaryClient++;
		this.clientAuthMap.set(client, authMember);

		const clientNick: string = authMember?.memberNick ?? 'Guest';
		this.logger.verbose(`Connection [${clientNick}] & total: [${this.summaryClient}]`);

		const infoMsg: InfoPayload = {
			event: 'info',
			totalClients: this.summaryClient,
			memberData: authMember,
			action: 'joined',
		};

		this.emitMessage(infoMsg);
		// CLIENT MESSAGE HISTORY
		client.send(JSON.stringify({ event: 'getMessages', list: this.messageList }));
	}

	public handleDisconnect(client: Websocket.WebSocket) {
		const authMember = this.clientAuthMap.get(client) ?? null;
		this.summaryClient--;
		this.clientAuthMap.delete(client);

		const clientNick: string = authMember?.memberNick ?? 'Guest';
		this.logger.verbose(`Disconnection [${clientNick}] & total: [${this.summaryClient}]`);

		const infoMsg: InfoPayload = {
			event: 'info',
			totalClients: this.summaryClient,
			memberData: authMember,
			action: 'left',
		};

		// Client - disconnect
		this.broadcastMessage(client, infoMsg);
	}

	@SubscribeMessage('message')
	public async handleMessage(client: any, payload: any): Promise<void> {
		const authMember = this.clientAuthMap.get(client);
		const newMessage: MessagePayload = { event: 'message', text: payload };

		const clientNick: string = authMember?.memberNick ?? 'Guest';
		this.logger.verbose(`NEW MESSAGE [${clientNick}]: ${payload}`);

		this.messageList.push(newMessage);
		if(this.messageList.length >= 5) this.messageList.splice(0, this.messageList.length - 5); // Keep only the last 5 messages
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
};



/**  

MESSAGE RATGET: 
1. Client (only client)
2. BroadCast (to all clients except sender)
3. Emit (to all clients)

**/
