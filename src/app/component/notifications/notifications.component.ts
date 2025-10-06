import { Component, OnInit } from '@angular/core';
import { NotificationService } from '../../service/notification.service';
import { Notification, NiveauAlerte, StatistiquesNotifications } from '../../model/notification.model';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit {
  notifications: Notification[] = [];
  stats?: StatistiquesNotifications;
  filtre: NiveauAlerte | 'TOUS' = 'TOUS';
  chargement = false;
  afficherSeulementNonLues = false;
  isSidebarOpen = true;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.chargerNotifications();
    this.chargerStats();
    this.notificationService.getNotificationsNonLuesAuto().subscribe(() => {
      this.chargerNotifications(false);
      this.chargerStats();
    });
  }

  chargerNotifications(showLoader: boolean = true): void {
    if (showLoader) this.chargement = true;

    const observable = this.afficherSeulementNonLues
      ? this.notificationService.getNotificationsNonLues()
      : this.notificationService.getToutesLesNotifications();

    observable.subscribe({
      next: (data) => {
        this.notifications = this.filtre === 'TOUS' ? data : data.filter(n => n.niveau === this.filtre);
        this.chargement = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des notifications:', err);
        this.chargement = false;
      }
    });
  }

  chargerStats(): void {
    this.notificationService.getStatistiques().subscribe({
      next: (s) => this.stats = s,
      error: (err) => console.error('Erreur lors du chargement des stats:', err)
    });
  }

  changerFiltre(f: NiveauAlerte | 'TOUS' | string): void {
    // Cast si string brut
    if (f === 'DANGER' || f === 'WARNING' || f === 'INFO' || f === 'SUCCESS') {
      this.filtre = f as NiveauAlerte;
    } else if (f === 'TOUS') {
      this.filtre = 'TOUS';
    }
    this.chargerNotifications(false);
  }

  basculerNonLues(): void {
    this.afficherSeulementNonLues = !this.afficherSeulementNonLues;
    this.chargerNotifications();
  }

  marquerCommeLue(n: Notification): void {
    if (n.lu) return;
    this.notificationService.marquerCommeLue(n.id).subscribe(() => {
      n.lu = true;
      this.chargerStats();
    });
  }

  marquerToutesCommeLues(): void {
    this.notificationService.marquerToutesCommeLues().subscribe(() => {
      this.notifications.forEach(n => n.lu = true);
      this.chargerStats();
    });
  }

  supprimer(n: Notification): void {
    if (!confirm('Supprimer cette notification ?')) return;
    this.notificationService.supprimerNotification(n.id).subscribe(() => {
      this.notifications = this.notifications.filter(x => x.id !== n.id);
      this.chargerStats();
    });
  }

  couleurBadge(niveau: string): string {
    switch (niveau) {
      case 'DANGER': return '#dc2626';
      case 'WARNING': return '#f97316';
      case 'SUCCESS': return '#16a34a';
      case 'INFO': return '#2563eb';
      default: return '#6b7280';
    }
  }

  icon(niveau: string): string {
    switch (niveau) {
      case 'DANGER': return '⚠️';
      case 'WARNING': return '⚠️';
      case 'SUCCESS': return '✅';
      case 'INFO': return 'ℹ️';
      default: return '🔔';
    }
  }
}
