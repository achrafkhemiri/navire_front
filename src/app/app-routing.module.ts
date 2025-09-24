import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { EtatGeneraleComponent } from './etat-generale/etat-generale.component';
import { EtatVenteComponent } from './etat-vente/etat-vente.component';
import { RecapVenteComponent } from './recap-vente/recap-vente.component';


const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'etat-generale', component: EtatGeneraleComponent },
  { path: 'etat-vente', component: EtatVenteComponent },
  { path: 'recap-vente', component: RecapVenteComponent },



  // Exemple de routes à ajouter :
  // { path: 'profil', component: ProfilComponent },
  // { path: 'parametres', component: ParametresComponent },
  { path: '**', redirectTo: '' } // Redirige toute route inconnue vers Home
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
