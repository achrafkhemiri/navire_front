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


const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'etat-generale', component: EtatGeneraleComponent },
  { path: 'etat-vente', component: EtatVenteComponent },
  { path: 'recap-vente', component: RecapVenteComponent },
  { path: 'chauffeur', component: ChauffeurComponent },
  { path: 'camion', component: CamionComponent },
  { path: 'client', component: ClientComponent },
  { path: 'depot', component: DepotComponent },
  { path: 'projet', component: ProjetComponent },
  { path: 'projet/:id/parametre', component: ProjetParametreComponent },
  { path: 'voyage', component: VoyageComponent },
  { path: 'projet-client', component: ProjetClientComponent },
  { path: '**', redirectTo: '' } // Redirige toute route inconnue vers Home
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
