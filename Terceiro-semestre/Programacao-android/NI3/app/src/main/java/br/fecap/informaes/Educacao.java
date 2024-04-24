package br.fecap.informaes;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import org.w3c.dom.Text;

import java.text.DecimalFormat;

public class Educacao extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_educacao);

        EditText editNI = findViewById(R.id.edit_EduNI);
        EditText editProj = findViewById(R.id.edit_EduProj);
        EditText editPO = findViewById(R.id.edit_EduPO);

        TextView txtNITotal = findViewById(R.id.txt_EduNITotal);
        TextView txtNIParcial = findViewById(R.id.txt_EduNIParcial);

        TextView txtProjParcial = findViewById(R.id.txt_EduProjParcial);
        TextView txtProjTotal = findViewById(R.id.txt_EduProjTotal);

        TextView txtPOParcial = findViewById(R.id.txt_EduPOParcial);
        TextView txtPOTotal = findViewById(R.id.txt_EduPOTotal);

        TextView txtTotal = findViewById(R.id.txt_EduNotaTotal);
        TextView txtStatus = findViewById(R.id.txt_EduStatus);

        Button btnLimpar = findViewById(R.id.btn_EduLimpar);
        Button btnEncerrar = findViewById(R.id.btn_EduEncerrar);

        // Mudar valores da NI
        editNI.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {

            }
            @Override
            public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {
                calcularNotas( editNI, editProj, editPO, txtNITotal, txtNIParcial,  txtProjTotal, txtProjParcial, txtPOTotal, txtPOParcial, txtStatus, txtTotal);
            }
            @Override
            public void afterTextChanged(Editable editable) {

            }
        });

        // Mudar valores do Projeto
        editProj.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {

            }
            @Override
            public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {
                calcularNotas( editNI, editProj, editPO, txtNITotal, txtNIParcial,  txtProjTotal, txtProjParcial, txtPOTotal, txtPOParcial, txtStatus, txtTotal);
            }
            @Override
            public void afterTextChanged(Editable editable) {

            }
        });


        // Mudar valores da Po
        editPO.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {

            }
            @Override
            public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {
                calcularNotas( editNI, editProj, editPO, txtNITotal, txtNIParcial,  txtProjTotal, txtProjParcial, txtPOTotal, txtPOParcial, txtStatus, txtTotal);
            }
            @Override
            public void afterTextChanged(Editable editable) {

            }
        });

        btnLimpar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                editNI.setText("");
                editProj.setText("");
                editPO.setText("");
                txtTotal.setText("Nota total: ");
                txtStatus.setText("Status: -");

            }
        });

        btnEncerrar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                startActivity(new Intent(Educacao.this, MainActivity.class));
                finish();
            }
        });


    }

    private void calcularNotas(EditText editNI, EditText editProj, EditText editPO, TextView txtNITotal, TextView txtNIParcial, TextView txtProjTotal, TextView txtProjParcial, TextView txtPOTotal, TextView txtPOParcial, TextView txtStatus, TextView txtTotal) {
        String niStr = editNI.getText().toString();
        String projStr = editProj.getText().toString();
        String poStr = editPO.getText().toString();

        if (!TextUtils.isEmpty(niStr) && !TextUtils.isEmpty(projStr) && !TextUtils.isEmpty(poStr)) {

            double ni = Double.parseDouble(niStr);
            double proj = Double.parseDouble(projStr);
            double po = Double.parseDouble(poStr);

            double niParcial = ni * 0.2;
            double projParcial = proj * 0.3;
            double poParcial = po * 0.5;

            double niTotal = ni;
            double projTotal = proj;
            double poTotal = po;

            double notaTotal = niParcial + projParcial + poParcial;

            DecimalFormat df = new DecimalFormat("#.##");

            txtNIParcial.setText("NI Parcial: " + df.format(niParcial));
            txtProjParcial.setText("Projeto Parcial: " + df.format(projParcial));
            txtPOParcial.setText("PO Parcial: " + df.format(poParcial));

            txtNITotal.setText("NI Total: " + niTotal);
            txtProjTotal.setText("Projeto Total: " + projTotal);
            txtPOTotal.setText("PO Total: " + poTotal);

            txtTotal.setText("Nota total: " + notaTotal);

            if(notaTotal < 6){
                txtStatus.setText("Status: Reprovado.");
            } else if (notaTotal>=6) {
                txtStatus.setText("Status: Aprovado!");
            }


        } else {
            txtNIParcial.setText("NI Parcial: -");
            txtProjParcial.setText("Projeto Parcial: -");
            txtPOParcial.setText("PO Parcial: -");

            txtNITotal.setText("NI Total: -");
            txtProjTotal.setText("Projeto Total: -");
            txtPOTotal.setText("PO Total: -");
        }
    }


}