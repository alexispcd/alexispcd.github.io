// Footer.js

import React from 'react';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-content">
                {/* Add mail, linkedin, github,  */}
                <p>Lorem ipsum dolor sit amet consectetur adipiscing elit ut, himenaeos duis etiam tempor velit ultricies sociosqu, ridiculus taciti commodo integer magnis congue torquent. Tincidunt condimentum torquent purus sodales a ornare facilisis ullamcorper aliquet ad tempor, mattis iaculis ligula porttitor libero tellus donec maecenas netus interdum, viverra cras sociosqu nulla class ultrices primis convallis ac scelerisque. Venenatis varius erat ac enim iaculis volutpat vitae per, egestas felis nulla sapien dictum quis congue sem eget, tristique neque eleifend libero ultricies accumsan integer.
                    
                    Suspendisse habitasse aliquet nunc rhoncus magna himenaeos suscipit nascetur hendrerit, praesent turpis eu laoreet justo erat neque netus dictumst, ac vulputate litora ultricies eleifend congue torquent felis. Imperdiet aenean bibendum blandit iaculis torquent etiam integer at, rhoncus in viverra ullamcorper curae cubilia quisque semper, lacinia nisi aliquet primis rutrum dictumst vulputate. Justo ultricies cras pulvinar nulla viverra suscipit faucibus habitasse conubia, convallis velit id vehicula scelerisque lectus tempus malesuada, congue dictum turpis dictumst est quam torquent pellentesque.</p>
            </div>
            <p className="footer-text">© {new Date().getFullYear().toString()} Alexis Pocard. All Rights Reserved.</p>
        </footer>
    );
};

export default Footer;
