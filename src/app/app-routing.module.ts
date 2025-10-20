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
import { ChargementComponent } from './component/chargement/chargement.component';
import { DechargementComponent } from './component/dechargement/dechargement.component';
import { ProjetClientComponent } from './component/projet-client/projet-client.component';
import { ProjetListComponent } from './projet-list/projet-list.component';
import { ClientsComponent } from './component/clients/clients.component';
import { DepotsComponent } from './component/depots/depots.component';
import { NotificationsComponent } from './component/notifications/notifications.component';
import { RecapComponent } from './component/recap/recap.component';
import { RecapDepotComponent } from './component/recap-depot/recap-depot.component';
import { DeclarationComponent } from './component/declaration/declaration.component';

// Importation des guards
import { AuthGuard } from './guards/auth.guard';
import { LoginGuard } from './guards/login.guard';


const routes: Routes = [
  // Route de connexion - accessible seulement si non authentifié
  { path: 'login', component: LoginComponent, canActivate: [LoginGuard] },
  
  // Routes protégées - nécessitent une authentification
  { path: 'projet-list', component: ProjetListComponent, canActivate: [AuthGuard] },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' }, // Page par défaut = login
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
  { path: 'declaration', component: DeclarationComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/parametre', component: ProjetParametreComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/voyages', component: VoyageComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/chargements', component: ChargementComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/recap', component: RecapComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/recap-depot', component: RecapDepotComponent, canActivate: [AuthGuard] },
  { path: 'voyage', component: VoyageComponent, canActivate: [AuthGuard] },
  { path: 'chargement', component: ChargementComponent, canActivate: [AuthGuard] },
  { path: 'dechargement', component: DechargementComponent, canActivate: [AuthGuard] },
  { path: 'recap', component: RecapComponent, canActivate: [AuthGuard] },
  { path: 'recap-depot', component: RecapDepotComponent, canActivate: [AuthGuard] },
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
