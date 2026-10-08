import { Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'ws';
import * as Websocket from 'ws';
import { AuthService } from '../components/auth/auth.service';
import { Member } from '../libs/dto/member/member';

interface MessagePayload {
	event: string;
	text: string;
	memberData: Member | null;
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
		const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
		const queryToken = requestUrl.searchParams.get('token'); // req ichidagi tokenni olish
		const authorization = req.headers.authorization; // req header ichidagi authorizationni olish
		const headerToken = typeof authorization === 'string' ? authorization.match(/^Bearer\s+(.+)$/i)?.[1] : undefined; // req header ichidagi tokenni olish
		const token = queryToken ?? headerToken;  // query param dan tokenni olish, agar bo'lmasa header dan olish

		if (!token) {
			this.logger.warn('WebSocket connection has no auth token; connected as Guest');
			return null;
		}

		try {
			return await this.authService.verifyToken(token);
		} catch (error) {
			this.logger.warn(
				`WebSocket token verification failed: ${error instanceof Error ? error.name : 'unknown error'}`,
			);
			return null;
		}
	}

	public async handleConnection(client: Websocket.WebSocket, req: any) { // yangi odam ulandi
		const authMember = await this.retrieveAuth(req); // tokenni tekshirib, memberni olish
		this.summaryClient++; // total clientni oshirish
		this.clientAuthMap.set(client, authMember); // clientni va memberni mapga qo'shish

		const clientNick: string = authMember?.memberNick ?? 'Guest'; // agar member bo'lsa nickni olish, bo'lmasa Guest deb qo'yish
		this.logger.verbose(`Connection [${clientNick}] & total: [${this.summaryClient}]`); // logga yozish

		const infoMsg: InfoPayload = {
			event: 'info',
			totalClients: this.summaryClient,
			memberData: authMember,
			action: 'joined',
		};

		this.emitMessage(infoMsg); // all Client send - join
		// CLIENT MESSAGE HISTORY
		client.send(JSON.stringify({ event: 'getMessages', list: this.messageList }));
	}

	public handleDisconnect(client: Websocket.WebSocket) { // odam chiqib ketti
		const authMember = this.clientAuthMap.get(client) ?? null; // clientni mapdan olish, agar bo'lmasa null
		this.summaryClient--; // total clientni kamaytirish
		this.clientAuthMap.delete(client); // clientni mapdan o'chirish

		const clientNick: string = authMember?.memberNick ?? 'Guest'; // agar member bo'lsa nickni olish, bo'lmasa Guest deb qo'yish
		this.logger.verbose(`Disconnection [${clientNick}] & total: [${this.summaryClient}]`); // logga yozish

		const infoMsg: InfoPayload = {
			event: 'info',
			totalClients: this.summaryClient,
			memberData: authMember,
			action: 'left',
		};

		// Client - disconnect
		this.broadcastMessage(client, infoMsg); // ozidan boshqa hammaga xabar boradi
	}

	@SubscribeMessage('message') 
	public async handleMessage(client: any, payload: any): Promise<void> {
		const authMember = this.clientAuthMap.get(client);
		const newMessage: MessagePayload = {
			event: 'message', text: payload,
			memberData: authMember ?? null,
		};

		const clientNick: string = authMember?.memberNick ?? 'Guest';
		this.logger.verbose(`NEW MESSAGE [${clientNick}]: ${payload}`);

		this.messageList.push(newMessage);
		if(this.messageList.length >= 5) this.messageList.splice(0, this.messageList.length - 5); // Keep only the last 5 messages
		this.emitMessage(newMessage);
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
1. Client (only client) faqat ozimizga xabar keladi
2. BroadCast (to all clients except sender) ozimizdan tashqari hammaga habar boradi
3. Emit (to all clients) hammaga birdaniga habar boradi


1. CLIENT   → faqat o'ziga
2. BROADCAST → o'zidan tashqari hammaga
3. EMIT      → hammaga (o'zi ham)
**/
