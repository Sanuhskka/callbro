import { ClientConnection, SignalMessage, SecureWebSocketServer } from '../websocket/WebSocketServer';

/**
 * SignalRouter - Маршрутизация сигнальных сообщений
 * 
 * Управляет передачей сигнальных сообщений между пользователями
 * для установления WebRTC соединений
 */

export interface RoutingStats {
  totalMessages: number;
  successfulRoutes: number;
  failedRoutes: number;
  offlineTargets: number;
  messagesByType: Record<string, number>;
}

export interface SignalRoute {
  from: string;
  to: string;
  type: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

export class SignalRouter {
  private wsServer: SecureWebSocketServer;
  private stats: RoutingStats;
  private recentRoutes: SignalRoute[] = [];
  private maxRecentRoutes = 1000;

  constructor(wsServer: SecureWebSocketServer) {
    this.wsServer = wsServer;
    this.stats = {
      totalMessages: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      offlineTargets: 0,
      messagesByType: {},
    };

    this.setupEventListeners();
  }

  /**
   * Устанавливает обработчики событий
   */
  private setupEventListeners(): void {
    this.wsServer.on('signal', (fromClient, toClient, message) => {
      this.handleSignalRouted(fromClient, toClient, message, true);
    });

    this.wsServer.on('user-disconnected', (userId) => {
      this.handleUserDisconnected(userId);
    });
  }

  /**
   * Маршрутизирует сигнальное сообщение
   */
  public routeMessage(message: SignalMessage): Promise<boolean> {
    return new Promise((resolve) => {
      this.stats.totalMessages++;
      this.stats.messagesByType[message.type] = (this.stats.messagesByType[message.type] || 0) + 1;

      // Проверяем, находится ли получатель в сети
      if (!this.wsServer.isUserOnline(message.to)) {
        this.stats.failedRoutes++;
        this.stats.offlineTargets++;

        this.recordRoute({
          from: message.from,
          to: message.to,
          type: message.type,
          timestamp: message.timestamp,
          success: false,
          error: 'Target user offline',
        });

        resolve(false);
        return;
      }

      // Отправляем сообщение целевому пользователю
      const success = this.sendSignalToUser(message);

      if (success) {
        this.stats.successfulRoutes++;
      } else {
        this.stats.failedRoutes++;
      }

      this.recordRoute({
        from: message.from,
        to: message.to,
        type: message.type,
        timestamp: message.timestamp,
        success,
        error: success ? undefined : 'Failed to send message',
      });

      resolve(success);
    });
  }

  /**
   * Отправляет сигнальное сообщение конкретному пользователю
   */
  private sendSignalToUser(message: SignalMessage): boolean {
    try {
      // WebSocket сервер уже обрабатывает отправку через событие 'signal'
      // Здесь мы просто эмулируем событие для маршрутизации
      this.wsServer.emit('route-signal', message);
      return true;
    } catch (error) {
      console.error(`Failed to route signal from ${message.from} to ${message.to}:`, error);
      return false;
    }
  }

  /**
   * Обрабатывает успешную маршрутизацию сигнала
   */
  private handleSignalRouted(
    fromClient: ClientConnection,
    toClient: ClientConnection,
    message: SignalMessage,
    success: boolean
  ): void {
    if (success) {
      console.log(`Signal routed: ${message.type} from ${fromClient.userId} to ${toClient.userId}`);
    } else {
      console.warn(`Signal routing failed: ${message.type} from ${fromClient.userId} to ${message.to}`);
    }
  }

  /**
   * Обрабатывает отключение пользователя
   */
  private handleUserDisconnected(userId: string): void {
    console.log(`User ${userId} disconnected, cleaning up routes`);
    
    // Очищаем недавние маршруты для отключенного пользователя
    this.recentRoutes = this.recentRoutes.filter(
      route => route.from !== userId && route.to !== userId
    );
  }

  /**
   * Записывает информацию о маршруте
   */
  private recordRoute(route: SignalRoute): void {
    this.recentRoutes.push(route);

    // Ограничиваем размер массива
    if (this.recentRoutes.length > this.maxRecentRoutes) {
      this.recentRoutes = this.recentRoutes.slice(-this.maxRecentRoutes);
    }
  }

  /**
   * Получает статистику маршрутизации
   */
  public getStats(): RoutingStats {
    return { ...this.stats };
  }

  /**
   * Получает недавние маршруты
   */
  public getRecentRoutes(limit?: number): SignalRoute[] {
    const routes = [...this.recentRoutes].reverse(); // Новые первые
    return limit ? routes.slice(0, limit) : routes;
  }

  /**
   * Получает маршруты для конкретного пользователя
   */
  public getUserRoutes(userId: string, limit?: number): SignalRoute[] {
    const userRoutes = this.recentRoutes.filter(
      route => route.from === userId || route.to === userId
    ).reverse();

    return limit ? userRoutes.slice(0, limit) : userRoutes;
  }

  /**
   * Получает статистику по типам сообщений
   */
  public getMessageTypeStats(): Record<string, { count: number; successRate: number }> {
    const typeStats: Record<string, { total: number; successful: number }> = {};

    this.recentRoutes.forEach(route => {
      if (!typeStats[route.type]) {
        typeStats[route.type] = { total: 0, successful: 0 };
      }
      typeStats[route.type].total++;
      if (route.success) {
        typeStats[route.type].successful++;
      }
    });

    const result: Record<string, { count: number; successRate: number }> = {};
    Object.entries(typeStats).forEach(([type, stats]) => {
      result[type] = {
        count: stats.total,
        successRate: stats.total > 0 ? stats.successful / stats.total : 0,
      };
    });

    return result;
  }

  /**
   * Проверяет наличие активных маршрутов для пользователя
   */
  public hasActiveRoutes(userId: string): boolean {
    return this.recentRoutes.some(
      route => (route.from === userId || route.to === userId) && 
               Date.now() - route.timestamp < 5 * 60 * 1000 // последние 5 минут
    );
  }

  /**
   * Очищает старые маршруты
   */
  public cleanupOldRoutes(maxAge: number = 60 * 60 * 1000): void { // 1 час по умолчанию
    const cutoffTime = Date.now() - maxAge;
    const beforeCount = this.recentRoutes.length;
    
    this.recentRoutes = this.recentRoutes.filter(
      route => route.timestamp > cutoffTime
    );

    const cleanedCount = beforeCount - this.recentRoutes.length;
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old signal routes`);
    }
  }

  /**
   * Сбрасывает статистику
   */
  public resetStats(): void {
    this.stats = {
      totalMessages: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      offlineTargets: 0,
      messagesByType: {},
    };
    this.recentRoutes = [];
    console.log('Signal router stats reset');
  }

  /**
   * Получает детальную информацию о маршрутизации
   */
  public getDetailedStats(): {
    overview: RoutingStats;
    typeStats: Record<string, { count: number; successRate: number }>;
    recentActivity: SignalRoute[];
    activeUsers: string[];
  } {
    const typeStats = this.getMessageTypeStats();
    const recentActivity = this.getRecentRoutes(50);
    
    // Получаем активных пользователей из последних маршрутов
    const activeUsers = new Set<string>();
    this.recentRoutes.forEach(route => {
      if (Date.now() - route.timestamp < 5 * 60 * 1000) { // последние 5 минут
        activeUsers.add(route.from);
        activeUsers.add(route.to);
      }
    });

    return {
      overview: this.getStats(),
      typeStats,
      recentActivity,
      activeUsers: Array.from(activeUsers),
    };
  }
}
