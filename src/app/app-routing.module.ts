import { ProjetParametreComponent } from './component/projet/projet-parametre.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { EtatGeneraleComponent } from './etat-generale/etat-generale.component';
import { EtatVenteComponent } from './etat-vente/etat-vente.component';
import { RecapVenteComponent } from './recap-vente/recap-vente.component';

import { ChauffeurComponent } from './component/chauffeur/chauffeur.component';
import { CamionComponent } from './component/camion/camion.component';
import { ClientComponent } from './component/client/client.component';
import { DepotComponent } from './component/depot/depot.component';
import { ProjetComponent } from './component/projet/projet.component';
import { VoyageComponent } from './component/voyage/voyage.component';
import { ProjetClientComponent } from './component/projet-client/projet-client.component';
import { ProjetListComponent } from './projet-list/projet-list.component';
import { ClientsComponent } from './component/clients/clients.component';
import { DepotsComponent } from './component/depots/depots.component';
import { NotificationsComponent } from './component/notifications/notifications.component';

// Importation des guards
import { AuthGuard } from './guards/auth.guard';
import { LoginGuard } from './guards/login.guard';


const routes: Routes = [
  // Route de connexion - accessible seulement si non authentifié
  { path: 'login', component: LoginComponent, canActivate: [LoginGuard] },
  
  // Routes protégées - nécessitent une authentification
  { path: 'projet-list', component: ProjetListComponent, canActivate: [AuthGuard] },
  { path: '', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'etat-generale', component: EtatGeneraleComponent, canActivate: [AuthGuard] },
  { path: 'etat-vente', component: EtatVenteComponent, canActivate: [AuthGuard] },
  { path: 'recap-vente', component: RecapVenteComponent, canActivate: [AuthGuard] },
  { path: 'chauffeur', component: ChauffeurComponent, canActivate: [AuthGuard] },
  { path: 'camion', component: CamionComponent, canActivate: [AuthGuard] },
  { path: 'client', component: ClientComponent, canActivate: [AuthGuard] },
  { path: 'depot', component: DepotComponent, canActivate: [AuthGuard] },
  { path: 'clients', component: ClientsComponent, canActivate: [AuthGuard] },
  { path: 'depots', component: DepotsComponent, canActivate: [AuthGuard] },
  { path: 'projet', component: ProjetComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/parametre', component: ProjetParametreComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/voyages', component: VoyageComponent, canActivate: [AuthGuard] },
  { path: 'voyage', component: VoyageComponent, canActivate: [AuthGuard] },
  { path: 'projet-client', component: ProjetClientComponent, canActivate: [AuthGuard] },
  { path: 'notifications', component: NotificationsComponent, canActivate: [AuthGuard] },
  
  // Redirection par défaut
  { path: '**', redirectTo: '' } // Redirige toute route inconnue vers Home
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
